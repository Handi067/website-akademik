import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { logger } from '@/utils/logger';

interface EarlyWarningConfig {
  ipkThreshold: {
    warning: number;
    critical: number;
  };
  attendanceThreshold: {
    warning: number; // percentage
    critical: number; // percentage
  };
  sksThreshold: {
    warning: number;
    critical: number;
  };
}

export class EarlyWarningService {
  private config: EarlyWarningConfig = {
    ipkThreshold: {
      warning: 2.0,
      critical: 1.5
    },
    attendanceThreshold: {
      warning: 75, // 75% attendance
      critical: 60  // 60% attendance
    },
    sksThreshold: {
      warning: 12,
      critical: 8
    }
  };

  async generateEarlyWarnings(): Promise<ApiResponse> {
    try {
      const currentSemester = this.getCurrentSemester();
      const currentTahunAjaran = this.getCurrentTahunAjaran();

      // Get all active students
      const mahasiswaList = await prisma.mahasiswa.findMany({
        where: {
          statusAkademik: 'AKTIF'
        },
        include: {
          nilai: {
            where: {
              semester: currentSemester,
              tahunAjaran: currentTahunAjaran
            }
          },
          krs: {
            where: {
              semester: currentSemester,
              tahunAjaran: currentTahunAjaran,
              status: 'AKTIF'
            },
            include: {
              jadwalKuliah: {
                include: {
                  matakuliah: true
                }
              }
            }
          },
          absensi: {
            include: {
              pertemuan: {
                include: {
                  matakuliah: true
                }
              }
            }
          }
        }
      });

      const warnings = [];

      for (const mahasiswa of mahasiswaList) {
        const studentWarnings = await this.checkStudentWarnings(mahasiswa, currentSemester, currentTahunAjaran);
        warnings.push(...studentWarnings);
      }

      // Save warnings to database
      await this.saveWarnings(warnings);

      // Generate notifications for critical warnings
      const criticalWarnings = warnings.filter(w => w.level === 'KRITIS');
      await this.generateNotifications(criticalWarnings);

      logger.info(`Generated ${warnings.length} early warnings for ${currentSemester} ${currentTahunAjaran}`);

      return {
        success: true,
        message: 'Early warnings generated successfully',
        data: {
          totalWarnings: warnings.length,
          criticalWarnings: criticalWarnings.length,
          semester: currentSemester,
          tahunAjaran: currentTahunAjaran
        }
      };
    } catch (error) {
      logger.error('Error generating early warnings:', error);
      return {
        success: false,
        message: 'Failed to generate early warnings',
        error: 'GENERATION_ERROR'
      };
    }
  }

  async checkStudentWarnings(mahasiswa: any, semester: string, tahunAjaran: string): Promise<any[]> {
    const warnings = [];

    // Check IPK
    const ipkWarning = await this.checkIPKWarning(mahasiswa, semester, tahunAjaran);
    if (ipkWarning) {
      warnings.push(ipkWarning);
    }

    // Check attendance
    const attendanceWarning = await this.checkAttendanceWarning(mahasiswa, semester, tahunAjaran);
    if (attendanceWarning) {
      warnings.push(attendanceWarning);
    }

    // Check SKS
    const sksWarning = await this.checkSKSWarning(mahasiswa, semester, tahunAjaran);
    if (sksWarning) {
      warnings.push(sksWarning);
    }

    // Check grade performance
    const gradeWarning = await this.checkGradeWarning(mahasiswa, semester, tahunAjaran);
    if (gradeWarning) {
      warnings.push(gradeWarning);
    }

    return warnings;
  }

  private async checkIPKWarning(mahasiswa: any, semester: string, tahunAjaran: string): Promise<any> {
    try {
      // Calculate current IPK
      const currentNilai = await prisma.nilai.findMany({
        where: {
          nim: mahasiswa.nim,
          semester,
          tahunAjaran
        },
        orderBy: [
          { semester: 'asc' },
          { tahunAjaran: 'asc' }
        ]
      });

      if (currentNilai.length === 0) {
        return null;
      }

      let totalBobot = 0;
      let totalSks = 0;

      for (const nilai of currentNilai) {
        const bobot = this.getBobot(nilai.grade);
        totalBobot += bobot * (nilai.matakuliah?.sks || 0);
        totalSks += nilai.matakuliah?.sks || 0;
      }

      const currentIPK = totalSks > 0 ? totalBobot / totalSks : 0;

      let level = 'NORMAL';
      let message = '';

      if (currentIPK < this.config.ipkThreshold.critical) {
        level = 'KRITIS';
        message = `IPK sangat rendah (${currentIPK.toFixed(2)}). Risiko tinggi untuk tidak lulus tepat waktu.`;
      } else if (currentIPK < this.config.ipkThreshold.warning) {
        level = 'SEDANG';
        message = `IPK rendah (${currentIPK.toFixed(2)}). Perlu perbaikan performa akademik.`;
      }

      if (level !== 'NORMAL') {
        return {
          nim: mahasiswa.nim,
          jenisWarning: 'IPK',
          level,
          threshold: this.config.ipkThreshold.warning,
          currentValue: currentIPK,
          pesan: message,
          status: 'AKTIF',
          createdAt: new Date()
        };
      }

      return null;
    } catch (error) {
      logger.error('Error checking IPK warning:', error);
      return null;
    }
  }

  private async checkAttendanceWarning(mahasiswa: any, semester: string, tahunAjaran: string): Promise<any> {
    try {
      // Get attendance data for current semester
      const absensiData = await prisma.absensi.findMany({
        where: {
          nim: mahasiswa.nim
        },
        include: {
          pertemuan: {
            where: {
              matakuliah: {
                jadwalKuliah: {
                  some: {
                    semester,
                    tahunAjaran,
                    status: 'AKTIF'
                  }
                }
              }
            }
          }
        }
      });

      if (absensiData.length === 0) {
        return null;
      }

      const totalPertemuan = absensiData.length;
      const totalHadir = absensiData.filter(a => a.statusHadir === 'HADIR').length;
      const attendancePercentage = totalPertemuan > 0 ? (totalHadir / totalPertemuan) * 100 : 0;

      let level = 'NORMAL';
      let message = '';

      if (attendancePercentage < this.config.attendanceThreshold.critical) {
        level = 'KRITIS';
        message = `Kehadiran sangat rendah (${attendancePercentage.toFixed(1)}%). Risiko tinggi untuk dropout.`;
      } else if (attendancePercentage < this.config.attendanceThreshold.warning) {
        level = 'SEDANG';
        message = `Kehadiran rendah (${attendancePercentage.toFixed(1)}%). Perlu perhatian khusus.`;
      }

      if (level !== 'NORMAL') {
        return {
          nim: mahasiswa.nim,
          jenisWarning: 'ABSENSI',
          level,
          threshold: this.config.attendanceThreshold.warning,
          currentValue: attendancePercentage,
          pesan: message,
          status: 'AKTIF',
          createdAt: new Date()
        };
      }

      return null;
    } catch (error) {
      logger.error('Error checking attendance warning:', error);
      return null;
    }
  }

  private async checkSKSWarning(mahasiswa: any, semester: string, tahunAjaran: string): Promise<any> {
    try {
      // Get current KRS
      const currentKrs = await prisma.krs.findMany({
        where: {
          nim: mahasiswa.nim,
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

      const totalSks = currentKrs.reduce((total, krs) => total + krs.jadwalKuliah.matakuliah.sks, 0);

      let level = 'NORMAL';
      let message = '';

      if (totalSks < this.config.sksThreshold.critical) {
        level = 'KRITIS';
        message = `SKS sangat rendah (${totalSks}). Tidak akan lulus tepat waktu.`;
      } else if (totalSks < this.config.sksThreshold.warning) {
        level = 'SEDANG';
        message = `SKS rendah (${totalSks}). Perlu tambah mata kuliah.`;
      }

      if (level !== 'NORMAL') {
        return {
          nim: mahasiswa.nim,
          jenisWarning: 'SKS',
          level,
          threshold: this.config.sksThreshold.warning,
          currentValue: totalSks,
          pesan: message,
          status: 'AKTIF',
          createdAt: new Date()
        };
      }

      return null;
    } catch (error) {
      logger.error('Error checking SKS warning:', error);
      return null;
    }
  }

  private async checkGradeWarning(mahasiswa: any, semester: string, tahunAjaran: string): Promise<any> {
    try {
      // Get recent grades
      const recentNilai = await prisma.nilai.findMany({
        where: {
          nim: mahasiswa.nim,
          grade: { in: ['D', 'E'] }
        },
        orderBy: {
          tahunAjaran: 'desc',
          semester: 'desc'
        },
        take: 3 // Check last 3 semesters
      });

      if (recentNilai.length >= 2) {
        return {
          nim: mahasiswa.nim,
          jenisWarning: 'NILAI',
          level: 'SEDANG',
          threshold: 0,
          currentValue: recentNilai.length,
          pesan: `Pola nilai buruk berulang (${recentNilai.length} semester terakhir). Perlu bimbingan akademik.`,
          status: 'AKTIF',
          createdAt: new Date()
        };
      }

      return null;
    } catch (error) {
      logger.error('Error checking grade warning:', error);
      return null;
    }
  }

  private async saveWarnings(warnings: any[]): Promise<void> {
    try {
      // Delete existing warnings for current semester
      const currentSemester = this.getCurrentSemester();
      const currentTahunAjaran = this.getCurrentTahunAjaran();

      await prisma.earlyWarning.deleteMany({
        where: {
          status: 'AKTIF'
        }
      });

      // Insert new warnings
      if (warnings.length > 0) {
        await prisma.earlyWarning.createMany({
          data: warnings
        });
      }

      logger.info(`Saved ${warnings.length} early warnings to database`);
    } catch (error) {
      logger.error('Error saving warnings:', error);
    }
  }

  private async generateNotifications(warnings: any[]): Promise<void> {
    try {
      const notifications = warnings.map(warning => ({
        userId: warning.nim, // This should be the user ID, not NIM
        judul: `Early Warning: ${warning.jenisWarning}`,
        pesan: warning.pesan,
        tipe: 'WARNING',
        priority: 'HIGH',
        data: {
          warningType: warning.jenisWarning,
          level: warning.level,
          currentValue: warning.currentValue,
          threshold: warning.threshold
        }
      }));

      // Create notifications
      await prisma.notifikasi.createMany({
        data: notifications.map(n => ({
          ...n,
          // Convert NIM to user ID
          userId: warnings.find(w => w.nim === n.nim)?.userId || ''
        }))
      });

      logger.info(`Generated ${notifications.length} notifications for critical warnings`);
    } catch (error) {
      logger.error('Error generating notifications:', error);
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

  private getCurrentSemester(): string {
    const date = new Date();
    const month = date.getMonth() + 1;
    
    if (month >= 2 && month <= 7) {
      return 'Genap';
    } else {
      return 'Ganjil';
    }
  }

  private getCurrentTahunAjaran(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    if (month >= 2 && month <= 7) {
      return `${year}/${year + 1}`;
    } else if (month >= 8 && month <= 12) {
      return `${year}/${year + 1}`;
    } else {
      return `${year - 1}/${year}`;
    }
  }

  async getStudentWarnings(nim: string): Promise<ApiResponse> {
    try {
      const warnings = await prisma.earlyWarning.findMany({
        where: {
          nim,
          status: { in: ['AKTIF', 'DITANGANI'] }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      });

      return {
        success: true,
        message: 'Student warnings retrieved successfully',
        data: warnings
      };
    } catch (error) {
      logger.error('Error getting student warnings:', error);
      return {
        success: false,
        message: 'Failed to retrieve student warnings',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async updateWarningStatus(warningId: string, status: string, handledBy: string): Promise<ApiResponse> {
    try {
      const updateData: any = {
        status,
        handledAt: new Date()
      };

      if (handledBy) {
        updateData.handledBy = handledBy;
      }

      await prisma.earlyWarning.update({
        where: { id: warningId },
        data: updateData
      });

      logger.info(`Warning ${warningId} updated to status: ${status}`);

      return {
        success: true,
        message: 'Warning status updated successfully'
      };
    } catch (error) {
      logger.error('Error updating warning status:', error);
      return {
        success: false,
        message: 'Failed to update warning status',
        error: 'UPDATE_ERROR'
      };
    }
  }

  async getWarningStats(tahunAjaran: string, semester: string): Promise<ApiResponse> {
    try {
      const warnings = await prisma.earlyWarning.findMany({
        where: {
          status: 'AKTIF'
        }
      });

      const stats = {
        total: warnings.length,
        byType: {
          IPK: warnings.filter(w => w.jenisWarning === 'IPK').length,
          ABSENSI: warnings.filter(w => w.jenisWarning === 'ABSENSI').length,
          SKS: warnings.filter(w => w.jenisWarning === 'SKS').length,
          NILAI: warnings.filter(w => w.jenisWarning === 'NILAI').length
        },
        byLevel: {
          KRITIS: warnings.filter(w => w.level === 'KRITIS').length,
          SEDANG: warnings.filter(w => w.level === 'SEDANG').length,
          RENDAH: warnings.filter(w => w.level === 'RENDAH').length
        }
      };

      return {
        success: true,
        message: 'Warning statistics retrieved successfully',
        data: stats
      };
    } catch (error) {
      logger.error('Error getting warning stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve warning statistics',
        error: 'STATS_ERROR'
      };
    }
  }
}
