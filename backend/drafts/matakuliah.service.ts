import { prisma } from '@/config/database';
import { 
  CreateMatakuliahRequest, 
  UpdateMatakuliahRequest,
  PaginatedRequest,
  FilterRequest,
  ApiResponse 
} from '@/types/academic.types';
import { logger } from '@/utils/logger';

export class MatakuliahService {
  async createMatakuliah(data: CreateMatakuliahRequest): Promise<ApiResponse> {
    try {
      // Check if kode MK already exists
      const existingMk = await prisma.matakuliah.findUnique({
        where: { kodeMk: data.kodeMk }
      });

      if (existingMk) {
        return {
          success: false,
          message: 'Kode mata kuliah already exists',
          error: 'KODE_MK_EXISTS'
        };
      }

      // Check if prerequisite exists (if provided)
      if (data.kodePrasyarat) {
        const prerequisite = await prisma.matakuliah.findUnique({
          where: { kodeMk: data.kodePrasyarat }
        });

        if (!prerequisite) {
          return {
            success: false,
            message: 'Prerequisite course not found',
            error: 'PREREQUISITE_NOT_FOUND'
          };
        }

        // Prevent circular prerequisite
        if (data.kodePrasyarat === data.kodeMk) {
          return {
            success: false,
            message: 'Course cannot be its own prerequisite',
            error: 'CIRCULAR_PREREQUISITE'
          };
        }
      }

      const matakuliah = await prisma.matakuliah.create({
        data,
        include: {
          prasyaratFor: {
            select: {
              kodeMk: true,
              namaMk: true
            }
          }
        }
      });

      logger.info(`Matakuliah created: ${matakuliah.kodeMk}`);

      return {
        success: true,
        message: 'Matakuliah created successfully',
        data: matakuliah
      };
    } catch (error) {
      logger.error('Error creating matakuliah:', error);
      return {
        success: false,
        message: 'Failed to create matakuliah',
        error: 'CREATE_ERROR'
      };
    }
  }

  async getMatakuliahList(
    pagination: PaginatedRequest = {},
    filters: FilterRequest = {}
  ): Promise<ApiResponse<{ matakuliah: any[]; pagination: any }>> {
    try {
      const { page = 1, limit = 10, search, sortBy = 'kodeMk', sortOrder = 'asc' } = pagination;
      const { semester } = filters;

      const skip = (page - 1) * limit;
      const where: any = {};

      if (search) {
        where.OR = [
          { kodeMk: { contains: search, mode: 'insensitive' } },
          { namaMk: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (semester) {
        where.semester = semester;
      }

      const [matakuliah, total] = await Promise.all([
        prisma.matakuliah.findMany({
          where,
          include: {
            prasyarat: {
              select: {
                kodeMk: true,
                namaMk: true
              }
            },
            prasyaratFor: {
              select: {
                kodeMk: true,
                namaMk: true
              }
            },
            _count: {
              select: {
                jadwalKuliah: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        prisma.matakuliah.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        message: 'Matakuliah list retrieved successfully',
        data: {
          matakuliah,
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
      logger.error('Error getting matakuliah list:', error);
      return {
        success: false,
        message: 'Failed to retrieve matakuliah list',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async getMatakuliahByKode(kodeMk: string): Promise<ApiResponse> {
    try {
      const matakuliah = await prisma.matakuliah.findUnique({
        where: { kodeMk },
        include: {
          prasyarat: {
            select: {
              kodeMk: true,
              namaMk: true,
              sks: true
            }
          },
          prasyaratFor: {
            select: {
              kodeMk: true,
              namaMk: true,
              sks: true
            }
          },
          jadwalKuliah: {
            include: {
              dosen: {
                select: {
                  nidn: true,
                  namaDosen: true
                }
              }
            }
          },
          _count: {
            select: {
              jadwalKuliah: true,
              nilai: true
            }
          }
        }
      });

      if (!matakuliah) {
        return {
          success: false,
          message: 'Matakuliah not found',
          error: 'NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Matakuliah retrieved successfully',
        data: matakuliah
      };
    } catch (error) {
      logger.error('Error getting matakuliah:', error);
      return {
        success: false,
        message: 'Failed to retrieve matakuliah',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async updateMatakuliah(
    kodeMk: string, 
    data: UpdateMatakuliahRequest
  ): Promise<ApiResponse> {
    try {
      const existingMk = await prisma.matakuliah.findUnique({
        where: { kodeMk }
      });

      if (!existingMk) {
        return {
          success: false,
          message: 'Matakuliah not found',
          error: 'NOT_FOUND'
        };
      }

      // Check if prerequisite exists (if provided)
      if (data.kodePrasyarat) {
        const prerequisite = await prisma.matakuliah.findUnique({
          where: { kodeMk: data.kodePrasyarat }
        });

        if (!prerequisite) {
          return {
            success: false,
            message: 'Prerequisite course not found',
            error: 'PREREQUISITE_NOT_FOUND'
          };
        }

        // Prevent circular prerequisite
        if (data.kodePrasyarat === kodeMk) {
          return {
            success: false,
            message: 'Course cannot be its own prerequisite',
            error: 'CIRCULAR_PREREQUISITE'
          };
        }
      }

      const updatedMatakuliah = await prisma.matakuliah.update({
        where: { kodeMk },
        data,
        include: {
          prasyarat: {
            select: {
              kodeMk: true,
              namaMk: true
            }
          },
          prasyaratFor: {
            select: {
              kodeMk: true,
              namaMk: true
            }
          }
        }
      });

      logger.info(`Matakuliah updated: ${kodeMk}`);

      return {
        success: true,
        message: 'Matakuliah updated successfully',
        data: updatedMatakuliah
      };
    } catch (error) {
      logger.error('Error updating matakuliah:', error);
      return {
        success: false,
        message: 'Failed to update matakuliah',
        error: 'UPDATE_ERROR'
      };
    }
  }

  async deleteMatakuliah(kodeMk: string): Promise<ApiResponse> {
    try {
      const existingMk = await prisma.matakuliah.findUnique({
        where: { kodeMk },
        include: {
          _count: {
            select: {
              jadwalKuliah: true,
              nilai: true,
              prasyaratFor: true
            }
          }
        }
      });

      if (!existingMk) {
        return {
          success: false,
          message: 'Matakuliah not found',
          error: 'NOT_FOUND'
        };
      }

      // Check if course is being used as prerequisite
      if (existingMk._count.prasyaratFor > 0) {
        return {
          success: false,
          message: 'Cannot delete course that is used as prerequisite',
          error: 'USED_AS_PREREQUISITE'
        };
      }

      // Check if course has active schedules or grades
      if (existingMk._count.jadwalKuliah > 0 || existingMk._count.nilai > 0) {
        return {
          success: false,
          message: 'Cannot delete course with active schedules or grades',
          error: 'HAS_DEPENDENCIES'
        };
      }

      await prisma.matakuliah.delete({
        where: { kodeMk }
      });

      logger.info(`Matakuliah deleted: ${kodeMk}`);

      return {
        success: true,
        message: 'Matakuliah deleted successfully'
      };
    } catch (error) {
      logger.error('Error deleting matakuliah:', error);
      return {
        success: false,
        message: 'Failed to delete matakuliah',
        error: 'DELETE_ERROR'
      };
    }
  }

  async getMatakuliahStats(): Promise<ApiResponse<{
    total: number;
    bySemester: Array<{ semester: string; count: number }>;
    bySks: Array<{ sks: number; count: number }>;
    totalSks: number;
  }>> {
    try {
      const [total, bySemester, bySks, totalSksResult] = await Promise.all([
        prisma.matakuliah.count(),
        prisma.matakuliah.groupBy({
          by: ['semester'],
          _count: { semester: true }
        }),
        prisma.matakuliah.groupBy({
          by: ['sks'],
          _count: { sks: true }
        }),
        prisma.matakuliah.aggregate({
          _sum: { sks: true }
        })
      ]);

      return {
        success: true,
        message: 'Matakuliah statistics retrieved successfully',
        data: {
          total,
          bySemester: bySemester.map((item: any) => ({
            semester: item.semester,
            count: item._count.semester
          })),
          bySks: bySks.map((item: any) => ({
            sks: item.sks,
            count: item._count.sks
          })),
          totalSks: totalSksResult._sum.sks || 0
        }
      };
    } catch (error) {
      logger.error('Error getting matakuliah stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve matakuliah statistics',
        error: 'STATS_ERROR'
      };
    }
  }
}
