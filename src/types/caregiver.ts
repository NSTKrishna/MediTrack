export interface CarePermissions {
  viewMedicines: boolean;
  viewDoseHistory: boolean;
  viewInventory: boolean;
  missedDoseAlerts: boolean;
  lowStockAlerts: boolean;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface Invitation {
  id: string;
  patientId: string;
  patientName: string;
  inviteeEmail: string;
  permissions: CarePermissions;
  status: InvitationStatus;
  createdAt: string | null;
  expiresAt: string;
}

export type CareLinkStatus = 'active' | 'revoked';

export interface CareLink {
  /** `${patientId}_${caregiverId}` */
  id: string;
  patientId: string;
  patientName: string;
  caregiverId: string;
  caregiverName: string;
  caregiverEmail: string;
  permissions: CarePermissions;
  status: CareLinkStatus;
  invitationId: string;
}

export type CareAlertType = 'missed-dose' | 'low-stock';

export interface CareAlert {
  id: string;
  type: CareAlertType;
  patientId: string;
  patientName: string;
  medicineName: string;
  message: string;
  createdAt: string | null;
  readAt: string | null;
}
