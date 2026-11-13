import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { logger } from '@/utils/logger';

interface BimbinganRequest {
  nim: string;
  nidnPembimbing: string;
  semester: string;
  tahunAkademik: string;
  catatan?: string;
}

interface BimbinganSession {
  id: string;
  nim: string;
  nidnPembimbing: string;
  semester: string;
  tahunAkademik: string;
  tanggal: Date;
  topik: string;
  catatanBimbingan: string;
  rekomendasi: string;
  status: string; // TERJADWAL, SELESAI, DIBATALKAN
  createdAt: Date;
  updatedAt: Date;
}

interface ProgressReport {
  id: string;
  bimbinganId: string;
  nim: string;
  periode: string;
  ipk: number;
  totalSks: number;
  mataKuliahDiambil: number;
  mataKuliahLulus: number;
  mataKuliahGagal: number;
  catatan: string;
  createdAt: Date;
}

export class BimbinganService {
  async createBimbingan(data: BimbinganRequest): Promise<ApiResponse> {
    try {
      // Check if student exists
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim: data.nim }
      });

      if (!mahasiswa) {
        return {
          success: false,
          message: 'Mahasiswa not found',
          error: 'MAHASISWA_NOT_FOUND'
        };
      }

      // Check if lecturer exists
      const dosen = await prisma.dosen.findUnique({
        where: { nidn: data.nidnPembimbing }
      });

      if (!dosen) {
        return {
          success: false,
          message: 'Dosen not found',
          error: 'DOSEN_NOT_FOUND'
        };
      }

      // Check if bimbingan already exists
      const existingBimbingan = await prisma.bimbingan.findFirst({
        where: {
          nim: data.nim,
          nidnPembimbing: data.nidnPembimbing,
          semester: data.semester,
          tahunAkademik: data.tahunAkademik,
          status: 'AKTIF'
        }
      });

      if (existingBimbingan) {
        return {
          success: false,
          message: 'Bimbingan already exists for this student and lecturer',
          error: 'BIMBINGAN_EXISTS'
        };
      }

      // Create bimbingan
      const bimbingan = await prisma.bimbingan.create({
        data: {
          nim: data.nim,
          nidnPembimbing: data.nidnPembimbing,
          semester: data.semester,
          tahunAkademik: data.tahunAkademik,
          status: 'AKTIF',
          catatan: data.catatan
        }
      });

      logger.info(`Bimbingan created: ${data.nim} - ${data.nidnPembimbing}`);

      return {
        success: true,
        message: 'Bimbingan created successfully',
        data: bimbingan
      };
    } catch (error) {
      logger.error('Error creating bimbingan:', error);
      return {
        success: false,
        message: 'Failed to create bimbingan',
        error: 'CREATE_ERROR'
      };
    }
  }

  async getBimbinganList(
    pagination: any = {},
    filters: any = {}
  ): Promise<ApiResponse> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const { nim, nidnPembimbing, semester, tahunAkademik, status } = filters;

      const skip = (page - 1) * limit;
      const where: any = {};

      if (nim) where.nim = nim;
      if (nidnPembimbing) where.nidnPembimbing = nidnPembimbing;
      if (semester) where.semester = semester;
      if (tahunAkademik) where.tahunAkademik = tahunAkademik;
      if (status) where.status = status;

      const [bimbingan, total] = await Promise.all([
        prisma.bimbingan.findMany({
          where,
          include: {
            mahasiswa: {
              select: {
                nim: true,
                namaMhs: true,
                jurusan: true,
                angkatan: true
              }
            },
            pembimbing: {
              select: {
                nidn: true,
                namaDosen: true,
                gelarDepan: true,
                gelarBelakang: true,
                departemen: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        prisma.bimbingan.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        message: 'Bimbingan list retrieved successfully',
        data: {
          bimbingan,
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
      logger.error('Error getting bimbingan list:', error);
      return {
        success: false,
        message: 'Failed to retrieve bimbingan list',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async getBimbinganByStudent(nim: string): Promise<ApiResponse> {
    try {
      const bimbingan = await prisma.bimbingan.findMany({
        where: { nim },
        include: {
          pembimbing: {
            select: {
              nidn: true,
              namaDosen: true,
              gelarDepan: true,
              gelarBelakang: true,
              departemen: true,
              email: true,
              noHp: true
            }
          }
        },
        orderBy: [
          { tahunAkademik: 'desc' },
          { semester: 'desc' }
        ]
      });

      return {
        success: true,
        message: 'Student bimbingan retrieved successfully',
        data: bimbingan
      };
    } catch (error) {
      logger.error('Error getting student bimbingan:', error);
      return {
        success: false,
        message: 'Failed to retrieve student bimbingan',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async getBimbinganByLecturer(nidnPembimbing: string): Promise<ApiResponse> {
    try {
      const bimbingan = await prisma.bimbingan.findMany({
        where: { nidnPembimbing },
        include: {
          mahasiswa: {
            select: {
              nim: true,
              namaMhs: true,
              jurusan: true,
              angkatan: true
            }
          }
        },
        orderBy: [
          { tahunAkademik: 'desc' },
          { semester: 'desc' }
        ]
      });

      return {
        success: true,
        message: 'Lecturer bimbingan retrieved successfully',
        data: bimbingan
      };
    } catch (error) {
      logger.error('Error getting lecturer bimbingan:', error);
      return {
        success: false,
        message: 'Failed to retrieve lecturer bimbingan',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async updateBimbinganStatus(bimbinganId: string, status: string, catatan?: string): Promise<ApiResponse> {
    try {
      const updateData: any = { status };
      
      if (catatan) {
        updateData.catatan = catatan;
      }

      if (status === 'SELESAI') {
        updateData.updatedAt = new Date();
      }

      const updatedBimbingan = await prisma.bimbingan.update({
        where: { id: bimbinganId },
        data: updateData
      });

      logger.info(`Bimbingan ${bimbinganId} status updated to: ${status}`);

      return {
        success: true,
        message: 'Bimbingan status updated successfully',
        data: updatedBimbingan
      };
    } catch (error) {
      logger.error('Error updating bimbingan status:', error);
      return {
        success: false,
        message: 'Failed to update bimbingan status',
        error: 'UPDATE_ERROR'
      };
    }
  }

  async createProgressReport(bimbinganId: string, data: any): Promise<ApiResponse> {
    try {
      // Get student's academic progress
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim: data.nim },
        include: {
          nilai: {
            where: {
              semester: data.semester,
              tahunAkademik: data.tahunAkademik
            }
          },
          krs: {
            where: {
              semester: data.semester,
              tahunAkademik: data.tahunAkademik,
              status: 'AKTIF'
            },
            include: {
              jadwalKuliah: {
                include: {
                  matakuliah: true
                }
              }
            }
          }
        }
      });

      if (!mahasiswa) {
        return {
          success: false,
          message: 'Mahasiswa not found',
          error: 'MAHASISWA_NOT_FOUND'
        };
      }

      // Calculate academic metrics
      const totalSks = mahasiswa.krs.reduce((total, krs) => total + krs.jadwalKuliah.matakuliah.sks, 0);
      const mataKuliahDiambil = new Set(mahasiswa.krs.map(krs => krs.jadwalKuliah.kodeMk)).size;
      
      let totalBobot = 0;
      let mataKuliahLulus = 0;
      let mataKuliahGagal = 0;

      for (const nilai of mahasiswa.nilai) {
        const bobot = this.getBobot(nilai.grade);
        totalBobot += bobot * (nilai.matakuliah?.sks || 0);
        
        if (['A', 'B_PLUS', 'B', 'C_PLUS', 'C'].includes(nilai.grade)) {
          mataKuliahLulus++;
        } else if (['D', 'E'].includes(nilai.grade)) {
          mataKuliahGagal++;
        }
      }

      const currentIPK = totalSks > 0 ? totalBobot / totalSks : 0;

      const progressReport = await prisma.progressReport.create({
        data: {
          bimbinganId,
          nim: data.nim,
          periode: `${data.semester} ${data.tahunAkademik}`,
          ipk: currentIPK,
          totalSks,
          mataKuliahDiambil,
          mataKuliahLulus,
          mataKuliahGagal,
          catatan: data.catatan || `Progress report for ${data.semester} ${data.tahunAkademik}`
        }
      });

      logger.info(`Progress report created: ${data.nim} - ${data.semester} ${data.tahunAkademik}`);

      return {
        success: true,
        message: 'Progress report created successfully',
        data: progressReport
      };
    } catch (error) {
      logger.error('Error creating progress report:', error);
      return {
        success: false,
        message: 'Failed to create progress report',
        error: 'CREATE_ERROR'
      };
    }
  }

  async getProgressReports(nim: string): Promise<ApiResponse> {
    try {
      const reports = await prisma.progressReport.findMany({
        where: { nim },
        include: {
          bimbingan: {
            include: {
              pembimbing: {
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
        orderBy: {
          periode: 'desc'
        }
      });

      return {
        success: true,
        message: 'Progress reports retrieved successfully',
        data: reports
      };
    } catch (error) {
      logger.error('Error getting progress reports:', error);
      return {
        success: false,
        message: 'Failed to retrieve progress reports',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async getBimbinganStats(tahunAkademik: string, semester: string): Promise<ApiResponse> {
    try {
      const bimbingan = await prisma.bimbingan.findMany({
        where: {
          tahunAkademik,
          semester
        },
        include: {
          mahasiswa: {
            select: {
              jurusan: true,
              angkatan: true
            }
          },
          pembimbing: {
            select: {
              departemen: true
            }
          }
        }
      });

      const total = bimbingan.length;
      const active = bimbingan.filter(b => b.status === 'AKTIF').length;
      const completed = bimbingan.filter(b => b.status === 'SELESAI').length;

      // Group by jurusan
      const jurusanStats = bimbingan.reduce((acc, b) => {
        const jurusan = b.mahasiswa.jurusan;
        if (!acc[jurusan]) {
          acc[jurusan] = { count: 0, active: 0, completed: 0 };
        }
        acc[jurusan].count++;
        if (b.status === 'AKTIF') acc[jurusan].active++;
        if (b.status === 'SELESAI') acc[jurusan].completed++;
        return acc;
      }, {} as any);

      // Group by pembimbing
      const pembimbingStats = bimbingan.reduce((acc, b) => {
        const departemen = b.pembimbing.departemen;
        if (!acc[departemen]) {
          acc[departemen] = { count: 0, active: 0, completed: 0 };
        }
        acc[departemen].count++;
        if (b.status === 'AKTIF') acc[departemen].active++;
        if (b.status === 'SELESAI') acc[departemen].completed++;
        return acc;
      }, {} as any);

      return {
        success: true,
        message: 'Bimbingan statistics retrieved successfully',
        data: {
          total,
          active,
          completed,
          completionRate: total > 0 ? (completed / total) * 100 : 0,
          byJurusan: Object.entries(jurusanStats).map(([jurusan, data]: [string, any]) => ({
            jurusan,
            count: data.count,
            active: data.active,
            completed: data.completed,
            completionRate: ((data.completed / data.count) * 100).toFixed(1)
          })),
          byDepartemen: Object.entries(pembimbingStats).map(([departemen, data]: [string, any]) => ({
            departemen,
            count: data.count,
            active: data.active,
            completed: data.completed,
            completionRate: ((data.completed / data.count) * 100).toFixed(1)
          }))
        }
      };
    } catch (error) {
      logger.error('Error getting bimbingan stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve bimbingan statistics',
        error: 'STATS_ERROR'
      };
    }
  }

  private getBobot(grade: string): number {
    const bobotMap: { [key: string]: number } = {
      'A': 4.0,
      'B_PLUS': 3.5,
      'B': 3.0,
      'C_PLUS': 2.5,
      'C': 2.0,
      'D': 1.0,
      'E': 0.0
    };

    return bobotMap[grade] || 0.0;
  }

  async assignStudentsToLecturer(nidnPembimbing: string, students: string[], semester: string, tahunAkademik: string): Promise<ApiResponse> {
    try {
      // Check if lecturer exists
      const dosen = await prisma.dosen.findUnique({
        where: { nidn: nidnPembimbing }
      });

      if (!dosen) {
        return {
          success: false,
          message: 'Lecturer not found',
          error: 'DOSEN_NOT_FOUND'
        };
      }

      // Check if students exist
      const mahasiswaList = await prisma.mahasiswa.findMany({
        where: {
          nim: { in: students }
        }
      });

      if (mahasiswaList.length !== students.length) {
        return {
          success: false,
          message: 'Some students not found',
          error: 'STUDENTS_NOT_FOUND'
        };
      }

      // Create bimbingan assignments
      const assignments = students.map(nim => ({
        nim,
        nidnPembimbing,
        semester,
        tahunAkademik,
        status: 'AKTIF',
        catatan: `Auto-assigned to ${dosen.namaDosen}`
      }));

      const createdAssignments = await prisma.bimbingan.createMany({
        data: assignments
      });

      logger.info(`Assigned ${students.length} students to lecturer ${nidnPembimbing}`);

      return {
        success: true,
        message: 'Students assigned to lecturer successfully',
        data: createdAssignments
      };
    } catch (error) {
      logger.error('Error assigning students to lecturer:', error);
      return {
        success: false,
        message: 'Failed to assign students to lecturer',
        error: 'ASSIGNMENT_ERROR'
      };
    }
  }

  async getStudentAcademicHistory(nim: string): Promise<ApiResponse> {
    try {
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim },
        include: {
          nilai: {
            include: {
              matakuliah: {
                select: {
                  kodeMk: true,
                  namaMk: true,
                  sks: true
                }
              }
            },
            orderBy: [
              { tahunAjaran: 'asc' },
              { semester: 'asc' },
              { kodeMk: 'asc' }
            ]
          },
          krs: {
            include: {
              jadwalKuliah: {
                include: {
                  matakuliah: true
                }
              }
            },
            orderBy: [
              { tahunAjaran: 'asc' },
              { semester: 'asc' }
            ]
          },
          bimbingan: {
            include: {
              pembimbing: {
                select: {
                  nidn: true,
                  namaDosen: true,
                  gelarDepan: true,
                  gelarBelakang: true
                }
              }
            },
            orderBy: [
              { tahunAkademik: 'desc' },
              { semester: 'desc' }
            ]
          }
        }
      });

      if (!mahasiswa) {
        return {
          success: false,
          message: 'Student not found',
          error: 'NOT_FOUND'
        };
      }

      // Calculate academic metrics
      const totalSks = mahasiswa.nilai.reduce((total, nilai) => total + (nilai.matakuliah?.sks || 0), 0);
      let totalBobot = 0;
      let totalCourses = new Set();

      for (const nilai of mahasiswa.nilai) {
        const bobot = this.getBobot(nilai.grade);
        totalBobot += bobot * (nilai.matakuliah?.sks || 0);
        totalCourses.add(nilai.kodeMk);
      }

      const ipk = totalSks > 0 ? totalBobot / totalSks : 0;

      return {
        success: true,
        message: 'Student academic history retrieved successfully',
        data: {
          mahasiswa: {
            nim: mahasiswa.nim,
            namaMhs: mahasiswa.namaMhs,
            jurusan: mahasiswa.jurusan,
            angkatan: mahasiswa.angkatan,
            ipk: mahasiswa.ipk || 0,
            totalSks: mahasiswa.totalSks || 0
          },
          academicHistory: {
            totalCourses: totalCourses.size,
            totalSks,
            ipk,
            nilai: mahasiswa.nilai,
            krs: mahasiswa.krs,
            bimbingan: mahasiswa.bimbingan
          }
        }
      };
    } catch (error) {
      logger.error('Error getting student academic history:', error);
      return {
        success: false,
        message: 'Failed to retrieve student academic history',
        error: 'RETRIEVE_ERROR'
      };
    }
  }
}
