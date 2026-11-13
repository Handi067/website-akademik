import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { logger } from '@/utils/logger';

interface KurikulumRequest {
  kodeKurikulum: string;
  namaKurikulum: string;
  tahunAkademik: string;
  totalSks: number;
  deskripsi?: string;
  nidnKaprodi?: string;
  tanggalMulai: Date;
  tanggalSelesai?: Date;
  status?: string;
}

interface KurikulumMkRequest {
  kurikulumId: string;
  kodeMk: string;
  semester: number;
  jenis: string; // WAJIB, PILIHAN, MATA KULIAH UMUM
  status?: string;
}

interface KurikulumMkDetail {
  id: string;
  kurikulumId: string;
  kodeMk: string;
  namaMk: string;
  sks: number;
  semester: number;
  jenis: string;
  status: string;
  matakuliah: {
    kodeMk: string;
    namaMk: string;
    sks: number;
    deskripsi: string;
    kodePrasyarat: string;
  };
}

export class KurikulumService {
  async createKurikulum(data: KurikulumRequest): Promise<ApiResponse> {
    try {
      // Check if kurikulum already exists
      const existingKurikulum = await prisma.kurikulum.findUnique({
        where: { kodeKurikulum: data.kodeKurikulum }
      });

      if (existingKurikulum) {
        return {
          success: false,
          message: 'Kurikulum already exists',
          error: 'KURIKULUM_EXISTS'
        };
      }

      // Check if kaprodi exists
      if (data.nidnKaprodi) {
        const kaprodi = await prisma.dosen.findUnique({
          where: { nidn: data.nidnKaprodi }
        });

        if (!kaprodi) {
          return {
            success: false,
            message: 'Kaprodi not found',
            error: 'KAPRODI_NOT_FOUND'
          };
        }
      }

      // Create kurikulum
      const kurikulum = await prisma.kurikulum.create({
        data: {
          kodeKurikulum: data.kodeKurikulum,
          namaKurikulum: data.namaKurikulum,
          tahunAkademik: data.tahunAkademik,
          totalSks: data.totalSks,
          deskripsi: data.deskripsi,
          nidnKaprodi: data.nidnKaprodi,
          tanggalMulai: data.tanggalMulai,
          tanggalSelesai: data.tanggalSelesai,
          status: data.status || 'AKTIF'
        }
      });

      logger.info(`Kurikulum created: ${data.kodeKurikulum}`);

      return {
        success: true,
        message: 'Kurikulum created successfully',
        data: kurikulum
      };
    } catch (error) {
      logger.error('Error creating kurikulum:', error);
      return {
        success: false,
        message: 'Failed to create kurikulum',
        error: 'CREATE_ERROR'
      };
    }
  }

  async addMataKuliahToKurikulum(data: KurikulumMkRequest): Promise<ApiResponse> {
    try {
      // Check if kurikulum exists
      const kurikulum = await prisma.kurikulum.findUnique({
        where: { id: data.kurikulumId }
      });

      if (!kurikulum) {
        return {
          success: false,
          message: 'Kurikulum not found',
          error: 'KURIKULUM_NOT_FOUND'
        };
      }

      // Check if mata kuliah exists
      const matakuliah = await prisma.matakuliah.findUnique({
        where: { kodeMk: data.kodeMk }
      });

      if (!matakuliah) {
        return {
          success: false,
          message: 'Mata kuliah not found',
          error: 'MAKULIAH_NOT_FOUND'
        };
      }

      // Check if mata kuliah already in kurikulum
      const existingKurikulumMk = await prisma.kurikulumMk.findFirst({
        where: {
          kurikulumId: data.kurikulumId,
          kodeMk: data.kodeMk
        }
      });

      if (existingKurikulumMk) {
        return {
          success: false,
          message: 'Mata kuliah already exists in this kurikulum',
          error: 'KURIKULUM_MK_EXISTS'
        };
      }

      // Add mata kuliah to kurikulum
      const kurikulumMk = await prisma.kurikulumMk.create({
        data: {
          kurikulumId: data.kurikulumId,
          kodeMk: data.kodeMk,
          semester: data.semester,
          jenis: data.jenis,
          status: data.status || 'AKTIF'
        }
      });

      logger.info(`Mata kuliah added to kurikulum: ${data.kodeMk} - ${data.kurikulumId}`);

      return {
        success: true,
        message: 'Mata kuliah added to kurikulum successfully',
        data: kurikulumMk
      };
    } catch (error) {
      logger.error('Error adding mata kuliah to kurikulum:', error);
      return {
        success: false,
        message: 'Failed to add mata kuliah to kurikulum',
        error: 'ADD_ERROR'
      };
    }
  }

  async getKurikulumList(
    pagination: any = {},
    filters: any = {}
  ): Promise<ApiResponse> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const { tahunAkademik, status, nidnKaprodi } = filters;

      const skip = (page - 1) * limit;
      const where: any = {};

      if (tahunAkademik) where.tahunAkademik = tahunAkademik;
      if (status) where.status = status;
      if (nidnKaprodi) where.nidnKaprodi = nidnKaprodi;

      const [kurikulum, total] = await Promise.all([
        prisma.kurikulum.findMany({
          where,
          include: {
            nidnKaprodi: {
              select: {
                nidn: true,
                namaDosen: true,
                gelarDepan: true,
                gelarBelakang: true,
                departemen: true
              }
            },
            kurikulumMk: {
              include: {
                matakuliah: {
                  select: {
                    kodeMk: true,
                    namaMk: true,
                    sks: true
                  }
                }
              }
            },
            _count: {
              select: {
                kurikulumMk: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        prisma.kurikulum.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        message: 'Kurikulum list retrieved successfully',
        data: {
          kurikulum,
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
      logger.error('Error getting kurikulum list:', error);
      return {
        success: false,
        message: 'Failed to retrieve kurikulum list',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async getKurikulumDetail(kurikulumId: string): Promise<ApiResponse> {
    try {
      const kurikulum = await prisma.kurikulum.findUnique({
        where: { id: kurikulumId },
        include: {
          nidnKaprodi: {
            select: {
              nidn: true,
              namaDosen: true,
              gelarDepan: true,
              gelarBelakang: true,
              departemen: true,
              email: true,
              noHp: true
            }
          },
          kurikulumMk: {
            include: {
              matakuliah: {
                select: {
                  kodeMk: true,
                  namaMk: true,
                  sks: true,
                  deskripsi: true,
                  kodePrasyarat: true,
                  prasyaratFor: {
                    select: {
                      kodeMk: true,
                      namaMk: true
                    }
                  }
                }
              },
              orderBy: [
                { semester: 'asc' },
                { matakuliah: { kodeMk: 'asc' } }
              ]
            }
          }
        }
      });

      if (!kurikulum) {
        return {
          success: false,
          message: 'Kurikulum not found',
          error: 'NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Kurikulum detail retrieved successfully',
        data: kurikulum
      };
    } catch (error) {
      logger.error('Error getting kurikulum detail:', error);
      return {
        success: false,
        message: 'Failed to retrieve kurikulum detail',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async updateKurikulum(kurikulumId: string, data: Partial<KurikulumRequest>): Promise<ApiResponse> {
    try {
      const existingKurikulum = await prisma.kurikulum.findUnique({
        where: { id: kurikulumId }
      });

      if (!existingKurikulum) {
        return {
          success: false,
          message: 'Kurikulum not found',
          error: 'NOT_FOUND'
        };
      }

      // Check if kaprodi exists (if provided)
      if (data.nidnKaprodi) {
        const kaprodi = await prisma.dosen.findUnique({
          where: { nidn: data.nidnKaprodi }
        });

        if (!kaprodi) {
          return {
            success: false,
            message: 'Kaprodi not found',
            error: 'KAPRODI_NOT_FOUND'
          };
        }
      }

      const updatedKurikulum = await prisma.kurikulum.update({
        where: { id: kurikulumId },
        data
      });

      logger.info(`Kurikulum updated: ${kurikulumId}`);

      return {
        success: true,
        message: 'Kurikulum updated successfully',
        data: updatedKurikulum
      };
    } catch (error) {
      logger.error('Error updating kurikulum:', error);
      return {
        success: false,
        message: 'Failed to update kurikulum',
        error: 'UPDATE_ERROR'
      };
    }
  }

  async updateKurikulumMkStatus(kurikulumMkId: string, status: string): Promise<ApiResponse> {
    try {
      const updatedKurikulumMk = await prisma.kurikulumMk.update({
        where: { id: kurikulumMkId },
        data: { status }
      });

      logger.info(`Kurikulum MK status updated: ${kurikulumMkId} - ${status}`);

      return {
        success: true,
        message: 'Kurikulum MK status updated successfully',
        data: updatedKurikulumMk
      };
    } catch (error) {
      logger.error('Error updating kurikulum MK status:', error);
      return {
        success: false,
        message: 'Failed to update kurikulum MK status',
        error: 'UPDATE_ERROR'
      };
    }
  }

  async getMataKuliahByKurikulum(kurikulumId: string): Promise<ApiResponse> {
    try {
      const kurikulumMkList = await prisma.kurikulumMk.findMany({
        where: { kurikulumId },
        include: {
          matakuliah: {
            select: {
              kodeMk: true,
              namaMk: true,
              sks: true,
              deskripsi: true,
              kodePrasyarat: true,
              prasyaratFor: {
                select: {
                  kodeMk: true,
                  namaMk: true
                }
              }
            }
          }
        },
        orderBy: [
          { semester: 'asc' },
          { matakuliah: { kodeMk: 'asc' } }
        ]
      });

      return {
        success: true,
        message: 'Mata kuliah by kurikulum retrieved successfully',
        data: kurikulumMkList
      };
    } catch (error) {
      logger.error('Error getting mata kuliah by kurikulum:', error);
      return {
        success: false,
        message: 'Failed to retrieve mata kuliah by kurikulum',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async getActiveKurikulum(): Promise<ApiResponse> {
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      let currentTahunAkademik = '';
      if (currentMonth >= 8 && currentMonth <= 12) {
        currentTahunAkademik = `${currentYear}/${currentYear + 1}`;
      } else if (currentMonth >= 2 && currentMonth <= 7) {
        currentTahunAkademik = `${currentYear - 1}/${currentYear}`;
      } else {
        currentTahunAkademik = `${currentYear - 1}/${currentYear}`;
      }

      const activeKurikulum = await prisma.kurikulum.findMany({
        where: {
          status: 'AKTIF',
          OR: [
            { tanggalSelesai: null },
            { tanggalSelesai: { gt: currentDate } }
          ]
        },
        include: {
          nidnKaprodi: {
            select: {
              nidn: true,
              namaDosen: true,
              gelarDepan: true,
              gelarBelakang: true
            }
          },
          _count: {
            select: {
              kurikulumMk: true
            }
          }
        },
        orderBy: {
          tahunAkademik: 'desc'
        }
      });

      return {
        success: true,
        message: 'Active kurikulum retrieved successfully',
        data: activeKurikulum
      };
    } catch (error) {
      logger.error('Error getting active kurikulum:', error);
      return {
        success: false,
        message: 'Failed to retrieve active kurikulum',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async getKurikulumStats(tahunAkademik?: string): Promise<ApiResponse> {
    try {
      const where: any = {};
      if (tahunAkademik) {
        where.tahunAkademik = tahunAkademik;
      }

      const kurikulum = await prisma.kurikulum.findMany({
        where,
        include: {
          _count: {
            select: {
              kurikulumMk: true
            }
          },
          kurikulumMk: {
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

      const total = kurikulum.length;
      const active = kurikulum.filter(k => k.status === 'AKTIF').length;
      const completed = kurikulum.filter(k => k.status === 'SELESAI').length;

      // Calculate total SKS across all kurikulum
      const totalSks = kurikulum.reduce((total, k) => {
        const kurikulumMkSks = k.kurikulumMk.reduce((sksTotal, km) => {
          const matakuliahSks = km.matakuliah.reduce((mkSks, mk) => mkSks + (mk.matakuliah?.sks || 0), 0);
          return sksTotal + matakuliahSks;
        }, 0);
        return total + kurikulumMkSks;
      }, 0);

      return {
        success: true,
        message: 'Kurikulum statistics retrieved successfully',
        data: {
          total,
          active,
          completed,
          totalSks,
          averageSksPerKurikulum: total > 0 ? (totalSks / total) : 0,
          completionRate: total > 0 ? (completed / total) * 100 : 0
        }
      };
    } catch (error) {
      logger.error('Error getting kurikulum stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve kurikulum statistics',
        error: 'STATS_ERROR'
      };
    }
  }

  async duplicateKurikulum(sourceKurikulumId: string, targetTahunAkademik: string, targetNamaKurikulum?: string): Promise<ApiResponse> {
    try {
      const sourceKurikulum = await prisma.kurikulum.findUnique({
        where: { id: sourceKurikulumId },
        include: {
          kurikulumMk: {
            include: {
              matakuliah: true
            }
          }
        }
      });

      if (!sourceKurikulum) {
        return {
          success: false,
          message: 'Source kurikulum not found',
          error: 'NOT_FOUND'
        };
      }

      // Create new kurikulum
      const newKurikulum = await prisma.kurikulum.create({
        data: {
          kodeKurikulum: this.generateKurikulumCode(),
          namaKurikulum: targetNamaKurikulum || `Copy of ${sourceKurikulum.namaKurikulum}`,
          tahunAkademik: targetTahunAkademik,
          totalSks: sourceKurikulum.totalSks,
          deskripsi: sourceKurikulum.deskripsi,
          nidnKaprodi: sourceKurikulum.nidnKaprodi,
          tanggalMulai: new Date(),
          status: 'AKTIF'
        }
      });

      // Copy all mata kuliah
      const kurikulumMkData = sourceKurikulum.kurikulumMk.map(kmk => ({
        kurikulumId: newKurikulum.id,
        kodeMk: kmk.kodeMk,
        semester: kmk.semester,
        jenis: kmk.jenis,
        status: 'AKTIF'
      }));

      await prisma.kurikulumMk.createMany({
        data: kurikulumMkData
      });

      logger.info(`Kurikulum duplicated: ${sourceKurikulumId} -> ${newKurikulum.id}`);

      return {
        success: true,
        message: 'Kurikulum duplicated successfully',
        data: newKurikulum
      };
    } catch (error) {
      logger.error('Error duplicating kurikulum:', error);
      return {
        success: false,
        message: 'Failed to duplicate kurikulum',
        error: 'DUPLICATE_ERROR'
      };
    }
  }

  private generateKurikulumCode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `KUR-${timestamp}-${random}`;
  }

  async deactivateKurikulum(kurikulumId: string): Promise<ApiResponse> {
    try {
      const updatedKurikulum = await prisma.kurikulum.update({
        where: { id: kurikulumId },
        data: {
          status: 'NONAKTIF',
          tanggalSelesai: new Date()
        }
      });

      logger.info(`Kurikulum deactivated: ${kurikulumId}`);

      return {
        success: true,
        message: 'Kurikulum deactivated successfully',
        data: updatedKurikulum
      };
    } catch (error) {
      logger.error('Error deactivating kurikulum:', error);
      return {
        success: false,
        message: 'Failed to deactivate kurikulum',
        error: 'DEACTIVATE_ERROR'
      };
    }
  }
}
