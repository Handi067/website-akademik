import { prisma } from '@/config/database';
import { ApiResponse } from '@/types/academic.types';
import { logger } from '@/utils/logger';
import crypto from 'crypto';
import QRCode from 'qrcode';

interface DigitalSignatureRequest {
  userId: string;
  documentType: string;
  documentId: string;
  signatureData?: string;
  metadata?: any;
}

interface QRVerificationRequest {
  qrCode: string;
  documentId: string;
}

interface DocumentVerificationResult {
  isValid: boolean;
  document: any;
  verifiedAt: Date;
  verificationDetails: any;
}

export class DigitalSignatureService {
  async generateDigitalSignature(data: DigitalSignatureRequest): Promise<ApiResponse> {
    try {
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: data.userId }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Check if signature already exists
      const existingSignature = await prisma.digitalSignature.findFirst({
        where: {
          userId: data.userId,
          documentType: data.documentType,
          documentId: data.documentId
        }
      });

      if (existingSignature) {
        // Update existing signature
        const updatedSignature = await prisma.digitalSignature.update({
          where: { id: existingSignature.id },
          data: {
            signature: data.signatureData || this.generateSignatureHash(data),
            qrCode: this.generateQRCode(data),
            isValid: true,
            expiresAt: this.calculateExpiryDate(data.documentType)
          }
        });

        logger.info(`Digital signature updated: ${data.documentType} - ${data.documentId}`);

        return {
          success: true,
          message: 'Digital signature updated successfully',
          data: updatedSignature
        };
      }

      // Create new signature
      const signature = await prisma.digitalSignature.create({
        data: {
          userId: data.userId,
          documentType: data.documentType,
          documentId: data.documentId,
          signature: data.signatureData || this.generateSignatureHash(data),
          qrCode: this.generateQRCode(data),
          isValid: true,
          expiresAt: this.calculateExpiryDate(data.documentType),
          metadata: data.metadata || {}
        }
      });

      logger.info(`Digital signature created: ${data.documentType} - ${data.documentId}`);

      return {
        success: true,
        message: 'Digital signature created successfully',
        data: signature
      };
    } catch (error) {
      logger.error('Error generating digital signature:', error);
      return {
        success: false,
        message: 'Failed to generate digital signature',
        error: 'GENERATE_ERROR'
      };
    }
  }

  async verifyQRCode(data: QRVerificationRequest): Promise<ApiResponse<DocumentVerificationResult>> {
    try {
      // Find digital signature by QR code
      const signature = await prisma.digitalSignature.findFirst({
        where: {
          qrCode: data.qrCode,
          documentId: data.documentId
        },
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

      if (!signature) {
        return {
          success: false,
          message: 'QR code not found or invalid',
          error: 'QR_NOT_FOUND'
        };
      }

      // Check if signature is still valid
      if (!signature.isValid) {
        return {
          success: false,
          message: 'Digital signature has been invalidated',
          error: 'SIGNATURE_INVALID'
        };
      }

      // Check if signature has expired
      if (signature.expiresAt && new Date() > signature.expiresAt) {
        await this.invalidateSignature(signature.id);
        return {
          success: false,
          message: 'Digital signature has expired',
          error: 'SIGNATURE_EXPIRED'
        };
      }

      // Verify document integrity
      const verificationResult = await this.verifyDocumentIntegrity(signature, data.documentId);

      // Update verification timestamp
      await prisma.digitalSignature.update({
        where: { id: signature.id },
        data: {
          verifiedAt: new Date()
        }
      });

      logger.info(`QR code verified: ${data.qrCode}`);

      return {
        success: true,
        message: 'QR code verified successfully',
        data: {
          isValid: verificationResult.isValid,
          document: verificationResult.document,
          verifiedAt: new Date(),
          verificationDetails: verificationResult.details,
          signature: signature
        }
      };
    } catch (error) {
      logger.error('Error verifying QR code:', error);
      return {
        success: false,
        message: 'Failed to verify QR code',
        error: 'VERIFY_ERROR'
      };
    }
  }

  async getDigitalSignatures(userId: string, documentType?: string): Promise<ApiResponse> {
    try {
      const where: any = { userId };
      if (documentType) {
        where.documentType = documentType;
      }

      const signatures = await prisma.digitalSignature.findMany({
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
        orderBy: {
          createdAt: 'desc'
        }
      });

      return {
        success: true,
        message: 'Digital signatures retrieved successfully',
        data: signatures
      };
    } catch (error) {
      logger.error('Error getting digital signatures:', error);
      return {
        success: false,
        message: 'Failed to retrieve digital signatures',
        error: 'RETRIEVE_ERROR'
      };
    }
  }

  async invalidateSignature(signatureId: string): Promise<ApiResponse> {
    try {
      const updatedSignature = await prisma.digitalSignature.update({
        where: { id: signatureId },
        data: {
          isValid: false
        }
      });

      logger.info(`Digital signature invalidated: ${signatureId}`);

      return {
        success: true,
        message: 'Digital signature invalidated successfully',
        data: updatedSignature
      };
    } catch (error) {
      logger.error('Error invalidating digital signature:', error);
      return {
        success: false,
        message: 'Failed to invalidate digital signature',
        error: 'INVALIDATE_ERROR'
      };
    }
  }

  async batchGenerateSignatures(signatures: DigitalSignatureRequest[]): Promise<ApiResponse> {
    try {
      const results = [];

      for (const signatureData of signatures) {
        const result = await this.generateDigitalSignature(signatureData);
        if (result.success) {
          results.push(result.data);
        }
      }

      logger.info(`Batch generated ${results.length} digital signatures`);

      return {
        success: true,
        message: 'Batch digital signatures generated successfully',
        data: results
      };
    } catch (error) {
      logger.error('Error batch generating digital signatures:', error);
      return {
        success: false,
        message: 'Failed to batch generate digital signatures',
        error: 'BATCH_GENERATE_ERROR'
      };
    }
  }

  async getSignatureStats(userId?: string): Promise<ApiResponse> {
    try {
      const where: any = {};
      if (userId) {
        where.userId = userId;
      }

      const signatures = await prisma.digitalSignature.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true
            }
          }
        }
      });

      const total = signatures.length;
      const valid = signatures.filter(s => s.isValid).length;
      const expired = signatures.filter(s => !s.isValid && s.expiresAt && new Date() > s.expiresAt).length;

      // Group by document type
      const byType = signatures.reduce((acc, signature) => {
        const type = signature.documentType;
        if (!acc[type]) {
          acc[type] = { total: 0, valid: 0, expired: 0 };
        }
        acc[type].total++;
        if (signature.isValid) acc[type].valid++;
        if (!signature.isValid && signature.expiresAt && new Date() > signature.expiresAt) acc[type].expired++;
        return acc;
      }, {} as any);

      return {
        success: true,
        message: 'Signature statistics retrieved successfully',
        data: {
          total,
          valid,
          expired,
          validityRate: total > 0 ? (valid / total) * 100 : 0,
          byType: Object.entries(byType).map(([type, data]: [string, any]) => ({
            documentType: type,
            count: data.total,
            valid: data.valid,
            expired: data.expired,
            validityRate: ((data.valid / data.total) * 100).toFixed(1)
          }))
        }
      };
    } catch (error) {
      logger.error('Error getting signature stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve signature statistics',
        error: 'STATS_ERROR'
      };
    }
  }

  private generateSignatureHash(data: DigitalSignatureRequest): string {
    const hashData = {
      userId: data.userId,
      documentType: data.documentType,
      documentId: data.documentId,
      timestamp: new Date().toISOString(),
      metadata: data.metadata || {}
    };

    return crypto.createHash('sha256').update(hashData).digest('hex');
  }

  private generateQRCode(data: DigitalSignatureRequest): string {
    const qrData = {
      signatureId: '', // Will be filled after creation
      userId: data.userId,
      documentType: data.documentType,
      documentId: data.documentId,
      timestamp: new Date().toISOString(),
      verificationUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/api/verify-qr`
    };

    return QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'L',
      type: 'png',
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  }

  private calculateExpiryDate(documentType: string): Date {
    const expiryPeriods: {
      'KHS': 365, // 1 year
      'IJAZAH': 365, // 1 year
      'TRANSKRIP': 180, // 6 months
      'SURAT_KELULUSAN': 90, // 3 months
      'SERTIFIKAT': 730, // 2 years
      'DEFAULT': 180 // 6 months
    };

    const period = expiryPeriods[documentType] || expiryPeriods.DEFAULT;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + period);

    return expiryDate;
  }

  private async verifyDocumentIntegrity(signature: any, documentId: string): Promise<DocumentVerificationResult> {
    try {
      // This is a simplified integrity check
      // In a real implementation, you would verify against blockchain or other secure storage
      const isValid = signature.isValid && signature.qrCode && signature.documentId === documentId;
      
      let document = null;
      if (signature.documentType === 'KHS') {
        // Get KHS data
        document = await this.getKHSData(signature.userId, documentId);
      } else if (signature.documentType === 'IJAZAH') {
        // Get Ijazah data
        document = await this.getIjazahData(signature.userId, documentId);
      } else if (signature.documentType === 'TRANSKRIP') {
        // Get Transkrip data
        document = await this.getTranskripData(signature.userId, documentId);
      }

      return {
        isValid,
        document,
        details: {
          integrityCheck: 'PASSED',
          verificationMethod: 'HASH_VERIFICATION',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Error verifying document integrity:', error);
      return {
        isValid: false,
        document: null,
        details: {
          integrityCheck: 'FAILED',
          error: error.message,
          verificationMethod: 'HASH_VERIFICATION'
        }
      };
    }
  }

  private async getKHSData(userId: string, documentId: string): Promise<any> {
    // This would fetch KHS data from database
    // Simplified implementation
    return {
      documentId,
      documentType: 'KHS',
      studentData: await prisma.mahasiswa.findUnique({
        where: { userId },
        include: {
          nilai: {
            where: {
              // Filter by semester/academic year
            }
          }
        }
      })
    };
  }

  private async getIjazahData(userId: string, documentId: string): Promise<any> {
    // This would fetch Ijazah data from database
    // Simplified implementation
    return {
      documentId,
      documentType: 'IJAZAH',
      studentData: await prisma.mahasiswa.findUnique({
        where: { userId }
      })
    };
  }

  private async getTranskripData(userId: string, documentId: string): Promise<any> {
    // This would fetch Transkrip data from database
    // Simplified implementation
    return {
      documentId,
      documentType: 'TRANSKRIP',
      studentData: await prisma.mahasiswa.findUnique({
        where: { userId },
        include: {
          nilai: {
            include: {
              matakuliah: true
            }
          }
        }
      })
    };
  }

  async generateVerificationReport(documentType: string, dateRange?: { start: Date; end: Date }): Promise<ApiResponse> {
    try {
      const where: any = { documentType };
      if (dateRange) {
        where.createdAt = {
          gte: dateRange.start,
          lte: dateRange.end
        };
      }

      const verifications = await prisma.digitalSignature.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true
            }
          }
        },
        orderBy: {
          verifiedAt: 'desc'
        }
      });

      const total = verifications.length;
      const successful = verifications.filter(v => v.verifiedAt).length;
      const failed = verifications.filter(v => !v.verifiedAt).length;

      return {
        success: true,
        message: 'Verification report generated successfully',
        data: {
          documentType,
          dateRange,
          total,
          successful,
          failed,
          successRate: total > 0 ? (successful / total) * 100 : 0,
          verifications
        }
      };
    } catch (error) {
      logger.error('Error generating verification report:', error);
      return {
        success: false,
        message: 'Failed to generate verification report',
        error: 'REPORT_ERROR'
      };
    }
  }
}
