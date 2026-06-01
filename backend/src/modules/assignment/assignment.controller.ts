import { Request, Response, NextFunction } from 'express';
import {
  getAssignmentByIdService,
  getAllAssignmentsService,
  getMyAssignmentsService,
  acceptAssignmentService,
  completeAssignmentService,
} from './assignment.service';
import { getIo } from '../../sockets/socket';
import { getParam } from '../../utils/helpers';

export const getAssignmentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignment = await getAssignmentByIdService(getParam(req.params.id));
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

export const getAllAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignments = await getAllAssignmentsService();
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
};

export const getMyAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const driverId = req.user!.id;
    const assignments = await getMyAssignmentsService(driverId);
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
};

export const acceptAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignment = await acceptAssignmentService(getParam(req.params.id));

    // Notify patient
    const io = getIo();
    io.to(`assignment:${assignment.id}`).emit('request:status_change', {
      status: 'accepted',
      assignment_id: assignment.id,
    });

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

export const completeAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignment = await completeAssignmentService(getParam(req.params.id));

    // Notify all parties
    const io = getIo();
    io.to(`assignment:${assignment.id}`).emit('request:status_change', {
      status: 'completed',
      assignment_id: assignment.id,
    });

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};
