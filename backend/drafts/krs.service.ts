import { prisma } from '@/config/database';
import { 
  AddKrsRequest,
  KrsResponse,
  ApiResponse,
  PaginatedRequest,
  FilterRequest
} from '@/types/academic.types';
import { logger } from '@/utils/logger';
import { KrsStatus, Role } from '@prisma/client';

export class KrsService {
  async addKrs(nim: string, data: AddKrsRequest): Promise<ApiResponse<KrsResponse>> {
    try {
      // Get student information
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim },
        include: {
          user: true
        }
      });

      if (!mahasiswa) {
        return {
          success: false,
          message: 'Mahasiswa not found',
          error: 'MAHASISWA_NOT_FOUND'
        };
      }

      // Get jadwal information
      const jadwal = await prisma.jadwalKuliah.findUnique({
        where: { id: data.jadwalId },
        include: {
          matakuliah: {
            include: {
              prasyarat: true
            }
          },
          krs: {
            where: {
              nim,
              semester: data.semester,
              tahunAjaran: data.tahunAjaran,
              status: 'AKTIF'
            },
            include: {
              matakuliah: {
                include: {
                  prasyarat: true
                }
              }
            }
          },
          _count: {
            select: {
              krs: true
            }
          }
        }
      });

      if (!jadwal) {
        return {
          success: false,
          message: 'Jadwal not found',
          error: 'JADWAL_NOT_FOUND'
        };
      }

      // Check if schedule is full
      if (jadwal._count.krs >= jadwal.kapasitas) {
        return {
          success: false,
          message: 'Class is already full',
          error: 'KELAS_PENUH'
        };
      }

      // Check for schedule conflicts
      const existingKrs = jadwal.krs;
      for (const existing of existingKrs) {
        if (existing.matakuliah.hari === jadwal.matakuliah.hari) {
          const existingStart = new Date(`2000-01-01 ${existing.matakuliah.jamMulai}`);
          const existingEnd = new Date(`2000-01-01 ${existing.matakuliah.jamSelesai}`);
          const newStart = new Date(`2000-01-01 ${jadwal.jamMulai}`);
          const newEnd = new Date(`2000-01-01 ${jadwal.jamSelesai}`);

          // Check for time overlap
          if ((newStart >= existingStart && newStart < existingEnd) ||
              (newEnd > existingStart && newEnd <= existingEnd) ||
              (newStart <= existingStart && newEnd >= existingEnd)) {
            return {
              success: false,
              message: `Schedule conflict with ${existing.matakuliah.namaMk}`,
              error: 'SCHEDULE_CONFLICT'
            };
          }
        }
      }

      // Check prerequisites
      if (jadwal.matakuliah.kodePrasyarat) {
        const prerequisiteMet = await this.checkPrerequisites(nim, jadwal.matakuliah.kodePrasyarat);
        if (!prerequisiteMet) {
          return {
            success: false,
            message: `Prerequisites not met for ${jadwal.matakuliah.namaMk}`,
            error: 'PREREQUISITE_NOT_MET',
            data: { 
              requiredCourse: jadwal.matakuliah.prasyarat.namaMk,
              requiredKode: jadwal.matakuliah.kodePrasyarat
            }
          };
        }
      }

      // Check if already registered
      const existingRegistration = await prisma.krs.findFirst({
        where: {
          nim,
          jadwalId: data.jadwalId,
          semester: data.semester,
          tahunAjaran: data.tahunAjaran
        }
      });

      if (existingRegistration) {
        return {
          success: false,
          message: 'Already registered for this course',
          error: 'ALREADY_REGISTERED'
        };
      }

      // Check maximum SKS
      const currentKrs = await prisma.krs.findMany({
        where: {
          nim,
          semester: data.semester,
          tahunAjaran: data.tahunAjaran,
          status: 'AKTIF'
        },
        include: {
          jadwalKuliah: {
            include: {
              matakuliah: true
            }
          }
        }
      });

      const currentSks = currentKrs.reduce((total, krs) => total + krs.jadwalKuliah.matakuliah.sks, 0);
      const maxSks = await this.getMaxSks(mahasiswa.jurusan, mahasiswa.angkatan, data.semester);
      
      if (currentSks + jadwal.matakuliah.sks > maxSks) {
        return {
          success: false,
          message: `Maximum SKS exceeded. Current: ${currentSks}, Max: ${maxSks}`,
          error: 'MAX_SKS_EXCEEDED',
          data: { currentSks, maxSks, requestedSks: jadwal.matakuliah.sks }
        };
      }

      // Check UKT payment
      const uktPaid = await this.checkUktPayment(nim, data.tahunAjaran, data.semester);
      if (!uktPaid) {
        return {
          success: false,
          message: 'UKT payment required before KRS registration',
          error: 'UKT_NOT_PAID'
        };
      }

      // Create KRS
      const krs = await prisma.krs.create({
        data: {
          nim,
          jadwalId: data.jadwalId,
          semester: data.semester,
          tahunAjaran: data.tahunAjaran,
          status: KrsStatus.AKTIF
        },
        include: {
          mahasiswa: {
            select: {
              nim: true,
              namaMhs: true,
              jurusan: true
            }
          },
          jadwalKuliah: {
            include: {
              matakuliah: {
                select: {
                  kodeMk: true,
                  namaMk: true,
                  sks: true
                }
              },
              dosen: {
                select: {
                  nidn: true,
                  namaDosen: true,
                  gelarDepan: true,
                  gelarBelakang: true
                }
              }
            }
          }
        }
      });

      logger.info(`KRS added: ${nim} - ${jadwal.matakuliah.kodeMk}`);

      return {
        success: true,
        message: 'Course added to KRS successfully',
        data: krs as KrsResponse
      };
    } catch (error) {
      logger.error('Error adding KRS:', error);
      return {
        success: false,
        message: 'Failed to add course to KRS',
        error: 'ADD_KRS_ERROR'
      };
    }
  }

  async getKrsList(
    nim: string,
    pagination: PaginatedRequest = {},
    filters: FilterRequest = {}
  ): Promise<ApiResponse<{ krs: KrsResponse[]; pagination: any }>> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const { semester, tahunAjaran, status } = filters;

      const skip = (page - 1) * limit;
      const where: any = { nim };

      if (semester) where.semester = semester;
      if (tahunAjaran) where.tahunAjaran = tahunAjaran;
      if (status) where.status = status;

      const [krs, total] = await Promise.all([
        prisma.krs.findMany({
          where,
          include: {
            mahasiswa: {
              select: {
                nim: true,
                namaMhs: true,
                jurusan: true
              }
            },
            jadwalKuliah: {
              include: {
                matakuliah: {
                  select: {
                    kodeMk: true,
                    namaMk: true,
                    sks: true,
                    kodePrasyarat: true
                  }
                },
                dosen: {
                  select: {
                    nidn: true,
                    namaDosen: true,
                    gelarDepan: true,
                    gelarBelakang: true
                  }
                }
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        prisma.krs.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        message: 'KRS list retrieved successfully',
        data: {
          krs: krs as KrsResponse[],
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
      logger.error('Error getting KRS list:', error);
      return {
        success: false,
        message: 'Failed to retrieve KRS list',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async approveKrs(krsId: string, approvedBy: string): Promise<ApiResponse> {
    try {
      const krs = await prisma.krs.findUnique({
        where: { id: krsId },
        include: {
          mahasiswa: {
            select: {
              nim: true,
              namaMhs: true
            }
          },
          jadwalKuliah: {
            include: {
              matakuliah: {
                select: {
                  kodeMk: true,
                  namaMk: true,
                  sks: true
                }
              }
            }
          }
        }
      });

      if (!krs) {
        return {
          success: false,
          message: 'KRS not found',
          error: 'NOT_FOUND'
        };
      }

      if (krs.isApproved) {
        return {
          success: false,
          message: 'KRS already approved',
          error: 'ALREADY_APPROVED'
        };
      }

      const updatedKrs = await prisma.krs.update({
        where: { id: krsId },
        data: {
          isApproved: true,
          approvedBy,
          approvedAt: new Date(),
          status: KrsStatus.SELESAI
        }
      });

      logger.info(`KRS approved: ${krsId} by ${approvedBy}`);

      return {
        success: true,
        message: 'KRS approved successfully',
        data: updatedKrs
      };
    } catch (error) {
      logger.error('Error approving KRS:', error);
      return {
        success: false,
        message: 'Failed to approve KRS',
        error: 'APPROVAL_ERROR'
      };
    }
  }

  async dropKrs(krsId: string, nim: string): Promise<ApiResponse> {
    try {
      const krs = await prisma.krs.findUnique({
        where: { id: krsId }
      });

      if (!krs) {
        return {
          success: false,
          message: 'KRS not found',
          error: 'NOT_FOUND'
        };
      }

      if (krs.nim !== nim) {
        return {
          success: false,
          message: 'Unauthorized to drop this KRS',
          error: 'UNAUTHORIZED'
        };
      }

      if (krs.isApproved) {
        return {
          success: false,
          message: 'Cannot drop approved KRS',
          error: 'ALREADY_APPROVED'
        };
      }

      await prisma.krs.delete({
        where: { id: krsId }
      });

      logger.info(`KRS dropped: ${krsId}`);

      return {
        success: true,
        message: 'KRS dropped successfully'
      };
    } catch (error) {
      logger.error('Error dropping KRS:', error);
      return {
        success: false,
        message: 'Failed to drop KRS',
        error: 'DROP_ERROR'
      };
    }
  }

  async getKrsSummary(nim: string, semester: string, tahunAjaran: string): Promise<ApiResponse<{
    totalSks: number;
    totalCourses: number;
    totalCredits: number;
    courses: Array<{
      kodeMk: string;
      namaMk: string;
      sks: number;
      status: string;
    }>;
  }>> {
    try {
      const krsList = await prisma.krs.findMany({
        where: {
          nim,
          semester,
          tahunAjaran,
          status: 'AKTIF'
        },
        include: {
          jadwalKuliah: {
            include: {
              matakuliah: true
            }
          }
        }
      });

      const totalSks = krsList.reduce((total, krs) => total + krs.jadwalKuliah.matakuliah.sks, 0);
      const totalCourses = krsList.length;
      
      // Calculate estimated cost (assuming 1 credit = Rp 100,000)
      const totalCredits = totalSks * 100000;

      const courses = krsList.map(krs => ({
        kodeMk: krs.jadwalKuliah.matakuliah.kodeMk,
        namaMk: krs.jadwalKuliah.matakuliah.namaMk,
        sks: krs.jadwalKuliah.matakuliah.sks,
        status: krs.status
      }));

      return {
        success: true,
        message: 'KRS summary retrieved successfully',
        data: {
          totalSks,
          totalCourses,
          totalCredits,
          courses
        }
      };
    } catch (error) {
      logger.error('Error getting KRS summary:', error);
      return {
        success: false,
        message: 'Failed to retrieve KRS summary',
        error: 'SUMMARY_ERROR'
      };
    }
  }

  private async checkPrerequisites(nim: string, kodePrasyarat: string): Promise<boolean> {
    try {
      // Check if student has passed the prerequisite course
      const nilai = await prisma.nilai.findFirst({
        where: {
          nim,
          kodeMk: kodePrasyarat,
          grade: { in: ['A', 'B_PLUS', 'B', 'C_PLUS', 'C'] }
        }
      });

      return !!nilai;
    } catch (error) {
      logger.error('Error checking prerequisites:', error);
      return false;
    }
  }

  private async getMaxSks(jurusan: string, angkatan: string, semester: string): Promise<number> {
    try {
      // Define SKS limits based on year and semester
      const yearLevel = parseInt(angkatan);
      const currentYear = new Date().getFullYear();
      const studentYear = currentYear - yearLevel;
      
      let maxSks = 24; // Default
      
      if (studentYear === 1) {
        maxSks = semester === 'Ganjil' ? 20 : 22;
      } else if (studentYear === 2) {
        maxSks = semester === 'Ganjil' ? 22 : 24;
      } else if (studentYear >= 3) {
        maxSks = 24;
      }

      return maxSks;
    } catch (error) {
      logger.error('Error getting max SKS:', error);
      return 24; // Default fallback
    }
  }

  private async checkUktPayment(nim: string, tahunAjaran: string, semester: string): Promise<boolean> {
    try {
      const pembayaran = await prisma.pembayaranUKT.findFirst({
        where: {
          nim,
          tahunAkademik: tahunAjaran,
          semester,
          status: 'SUDAH_BAYAR'
        }
      });

      return !!pembayaran;
    } catch (error) {
      logger.error('Error checking UKT payment:', error);
      return false;
    }
  }

  async getKrsStats(tahunAjaran: string, semester: string): Promise<ApiResponse<{
    totalStudents: number;
    totalCourses: number;
    averageSks: number;
    byJurusan: Array<{
      jurusan: string;
      count: number;
      totalSks: number;
    }>;
  }>> {
    try {
      const krsList = await prisma.krs.findMany({
        where: {
          tahunAjaran,
          semester,
          status: 'AKTIF'
        },
        include: {
          mahasiswa: {
            select: {
              jurusan: true
            }
          },
          jadwalKuliah: {
            include: {
              matakuliah: {
                select: {
                  sks: true
                }
              }
            }
          }
        }
      });

      const totalStudents = new Set(krsList.map(k => k.nim)).size;
      const totalCourses = new Set(krsList.map(k => k.jadwalId)).size;
      const totalSks = krsList.reduce((total, krs) => total + krs.jadwalKuliah.matakuliah.sks, 0);
      const averageSks = totalStudents > 0 ? totalSks / totalStudents : 0;

      // Group by jurusan
      const jurusanMap = new Map();
      krsList.forEach(krs => {
        const jurusan = krs.mahasiswa.jurusan;
        if (!jurusanMap.has(jurusan)) {
          jurusanMap.set(jurusan, { count: 0, totalSks: 0 });
        }
        const data = jurusanMap.get(jurusan);
        data.count++;
        data.totalSks += krs.jadwalKuliah.matakuliah.sks;
      });

      const byJurusan = Array.from(jurusanMap.entries()).map(([jurusan, data]) => ({
        jurusan,
        count: data.count,
        totalSks: data.totalSks
      }));

      return {
        success: true,
        message: 'KRS statistics retrieved successfully',
        data: {
          totalStudents,
          totalCourses,
          averageSks: Math.round(averageSks * 100) / 100,
          byJurusan
        }
      };
    } catch (error) {
      logger.error('Error getting KRS stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve KRS statistics',
        error: 'STATS_ERROR'
      };
    }
  }
}
