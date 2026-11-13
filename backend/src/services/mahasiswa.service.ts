import { prisma } from '@/config/database';
import { 
  CreateMahasiswaRequest, 
  UpdateMahasiswaRequest, 
  MahasiswaResponse,
  PaginatedRequest,
  FilterRequest,
  ApiResponse 
} from '@/types/academic.types';
import { logger } from '@/utils/logger';
import { hashPassword } from '@/utils/password';
import { Role } from '@prisma/client';

export class MahasiswaService {
  async createMahasiswa(data: CreateMahasiswaRequest): Promise<ApiResponse<MahasiswaResponse>> {
    try {
      // Check if NIM already exists
      const existingMahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim: data.nim }
      });

      if (existingMahasiswa) {
        return {
          success: false,
          message: 'NIM already exists',
          error: 'NIM_EXISTS'
        };
      }

      // The login account is created together with the student profile
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username: data.username }, { email: data.email }] },
        select: { id: true }
      });

      if (existingUser) {
        return {
          success: false,
          message: 'Username atau email sudah dipakai',
          error: 'USER_EXISTS'
        };
      }

      const { username, email, password, ...profil } = data;
      const passwordHash = await hashPassword(password);

      const mahasiswa = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { username, email, passwordHash, role: Role.MAHASISWA }
        });
        return tx.mahasiswa.create({
          data: { ...profil, userId: user.id },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          }
        });
      });

      logger.info(`Mahasiswa created: ${mahasiswa.nim}`);

      return {
        success: true,
        message: 'Mahasiswa created successfully',
        data: mahasiswa as MahasiswaResponse
      };
    } catch (error) {
      logger.error('Error creating mahasiswa:', error);
      return {
        success: false,
        message: 'Failed to create mahasiswa',
        error: 'CREATE_ERROR'
      };
    }
  }

  async getMahasiswaList(
    pagination: PaginatedRequest = {},
    filters: FilterRequest = {}
  ): Promise<ApiResponse<{ mahasiswa: MahasiswaResponse[]; pagination: any }>> {
    try {
      const { page = 1, limit = 10, search, sortBy = 'nim', sortOrder = 'asc' } = pagination;
      const { jurusan, angkatan } = filters;

      const skip = (page - 1) * limit;
      const where: any = {};

      if (search) {
        where.OR = [
          { nim: { contains: search, mode: 'insensitive' } },
          { namaMhs: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (jurusan) {
        where.jurusan = jurusan;
      }

      if (angkatan) {
        where.angkatan = angkatan;
      }

      const [mahasiswa, total] = await Promise.all([
        prisma.mahasiswa.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        prisma.mahasiswa.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        message: 'Mahasiswa list retrieved successfully',
        data: {
          mahasiswa: mahasiswa as MahasiswaResponse[],
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        }
      };
    } catch (error) {
      logger.error('Error getting mahasiswa list:', error);
      return {
        success: false,
        message: 'Failed to retrieve mahasiswa list',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async getMahasiswaByNim(nim: string): Promise<ApiResponse<MahasiswaResponse>> {
    try {
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true
            }
          }
        }
      });

      if (!mahasiswa) {
        return {
          success: false,
          message: 'Mahasiswa not found',
          error: 'NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Mahasiswa retrieved successfully',
        data: mahasiswa as MahasiswaResponse
      };
    } catch (error) {
      logger.error('Error getting mahasiswa:', error);
      return {
        success: false,
        message: 'Failed to retrieve mahasiswa',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async updateMahasiswa(
    nim: string, 
    data: UpdateMahasiswaRequest
  ): Promise<ApiResponse<MahasiswaResponse>> {
    try {
      const existingMahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim }
      });

      if (!existingMahasiswa) {
        return {
          success: false,
          message: 'Mahasiswa not found',
          error: 'NOT_FOUND'
        };
      }

      const updatedMahasiswa = await prisma.mahasiswa.update({
        where: { nim },
        data,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true
            }
          }
        }
      });

      logger.info(`Mahasiswa updated: ${nim}`);

      return {
        success: true,
        message: 'Mahasiswa updated successfully',
        data: updatedMahasiswa as MahasiswaResponse
      };
    } catch (error) {
      logger.error('Error updating mahasiswa:', error);
      return {
        success: false,
        message: 'Failed to update mahasiswa',
        error: 'UPDATE_ERROR'
      };
    }
  }

  async deleteMahasiswa(nim: string): Promise<ApiResponse> {
    try {
      const existingMahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim },
        select: { userId: true, _count: { select: { krs: true, nilai: true, tagihan: true } } }
      });

      if (!existingMahasiswa) {
        return {
          success: false,
          message: 'Mahasiswa not found',
          error: 'NOT_FOUND'
        };
      }

      // Cascade would silently erase KRS, grades and bills — keep academic records.
      const { krs, nilai, tagihan } = existingMahasiswa._count;
      if (krs + nilai + tagihan > 0) {
        return {
          success: false,
          message: 'Mahasiswa sudah memiliki KRS, nilai, atau tagihan sehingga tidak dapat dihapus',
          error: 'IN_USE'
        };
      }

      // Deleting the user removes the profile via cascade and leaves no orphan login.
      await prisma.user.delete({
        where: { id: existingMahasiswa.userId }
      });

      logger.info(`Mahasiswa deleted: ${nim}`);

      return {
        success: true,
        message: 'Mahasiswa deleted successfully'
      };
    } catch (error) {
      logger.error('Error deleting mahasiswa:', error);
      return {
        success: false,
        message: 'Failed to delete mahasiswa',
        error: 'DELETE_ERROR'
      };
    }
  }

  async getMahasiswaStats(): Promise<ApiResponse<{
    total: number;
    byJurusan: Array<{ jurusan: string; count: number }>;
    byAngkatan: Array<{ angkatan: string; count: number }>;
  }>> {
    try {
      const [total, byJurusan, byAngkatan] = await Promise.all([
        prisma.mahasiswa.count(),
        prisma.mahasiswa.groupBy({
          by: ['jurusan'],
          _count: { jurusan: true }
        }),
        prisma.mahasiswa.groupBy({
          by: ['angkatan'],
          _count: { angkatan: true }
        })
      ]);

      return {
        success: true,
        message: 'Mahasiswa statistics retrieved successfully',
        data: {
          total,
          byJurusan: byJurusan.map(item => ({
            jurusan: item.jurusan,
            count: item._count.jurusan
          })),
          byAngkatan: byAngkatan.map(item => ({
            angkatan: item.angkatan,
            count: item._count.angkatan
          }))
        }
      };
    } catch (error) {
      logger.error('Error getting mahasiswa stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve mahasiswa statistics',
        error: 'STATS_ERROR'
      };
    }
  }
}
