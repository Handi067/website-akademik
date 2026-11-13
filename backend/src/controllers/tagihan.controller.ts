import { Request, Response } from 'express';
import { TagihanService } from '../services/tagihan.service';
import { JenisTagihan } from '@prisma/client';
import { isError, targetNim } from '../utils/actor';

const tagihanService = new TagihanService();

export class TagihanController {
  async getMyTagihan(req: Request, res: Response) {
    try {
      // Mahasiswa hanya melihat tagihannya sendiri; admin memilih lewat ?nim=
      const target = await targetNim(req);
      if (isError(target)) {
        return res.status(target.error === 'FORBIDDEN' ? 403 : 400).json(target);
      }

      const data = await tagihanService.getTagihanMahasiswa(target.nim);
      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async createTagihan(req: Request, res: Response) {
    try {
       const { nim, jenisTagihan, jumlah, tenggatWaktu, keterangan } = req.body;
       const data = await tagihanService.createTagihanBase(
         nim, 
         jenisTagihan as JenisTagihan, 
         Number(jumlah), 
         new Date(tenggatWaktu), 
         keterangan
       );
       return res.status(201).json({ success: true, data });
    } catch (error: any) {
       return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAllTagihan(req: Request, res: Response) {
     try {
       const data = await tagihanService.getAllTagihan();
       return res.status(200).json({ success: true, data });
     } catch (error: any) {
       return res.status(500).json({ success: false, message: error.message });
     }
  }
}
