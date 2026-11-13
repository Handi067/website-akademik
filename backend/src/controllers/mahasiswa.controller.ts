import { Request, Response } from 'express';
import { MahasiswaService } from '@/services/mahasiswa.service';
import { ApiResponse } from '@/types/academic.types';
import { logger } from '@/utils/logger';

export class MahasiswaController {
  private mahasiswaService: MahasiswaService;

  constructor() {
    this.mahasiswaService = new MahasiswaService();
  }

  createMahasiswa = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.mahasiswaService.createMahasiswa(req.body);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Create mahasiswa controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  getMahasiswaList = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sortBy = 'nim',
        sortOrder = 'asc',
        jurusan,
        angkatan
      } = req.query;

      const pagination = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const filters = {
        jurusan: jurusan as string,
        angkatan: angkatan as string
      };

      const result = await this.mahasiswaService.getMahasiswaList(pagination, filters);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Get mahasiswa list controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  getMahasiswaByNim = async (req: Request, res: Response): Promise<void> => {
    try {
      const { nim } = req.params;
      const result = await this.mahasiswaService.getMahasiswaByNim(nim);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        if (result.error === 'NOT_FOUND') {
          res.status(404).json(result);
        } else {
          res.status(400).json(result);
        }
      }
    } catch (error) {
      logger.error('Get mahasiswa controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  updateMahasiswa = async (req: Request, res: Response): Promise<void> => {
    try {
      const { nim } = req.params;
      const result = await this.mahasiswaService.updateMahasiswa(nim, req.body);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        if (result.error === 'NOT_FOUND') {
          res.status(404).json(result);
        } else {
          res.status(400).json(result);
        }
      }
    } catch (error) {
      logger.error('Update mahasiswa controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  deleteMahasiswa = async (req: Request, res: Response): Promise<void> => {
    try {
      const { nim } = req.params;
      const result = await this.mahasiswaService.deleteMahasiswa(nim);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        if (result.error === 'NOT_FOUND') {
          res.status(404).json(result);
        } else {
          res.status(result.error === 'IN_USE' ? 409 : 400).json(result);
        }
      }
    } catch (error) {
      logger.error('Delete mahasiswa controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };

  getMahasiswaStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.mahasiswaService.getMahasiswaStats();
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Get mahasiswa stats controller error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      };
      res.status(500).json(response);
    }
  };
}
