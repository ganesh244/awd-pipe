export type PipeStatus = 'Available' | 'Installed' | 'Damaged' | 'Removed' | 'Replaced';

export type EstablishmentMethod = 'Dry DSR' | 'Wet DSR' | 'TPR';

export type IrrigationSource = 'Borewell' | 'Canal' | 'Tank' | 'Other';

export type PlotUnit = 'Acres' | 'Hectares';

export type AWDFollowed = 'Yes' | 'No' | 'Partially';

export type PipeCondition = 'Good' | 'Damaged' | 'Missing' | 'Replaced';

export type CropStage = 'Tillering' | 'Panicle Initiation' | 'Flowering' | 'Grain Filling' | 'Harvesting' | 'Vegetative';

/** Hierarchy: Admin > State Manager > District Manager > Area Manager > CF > JCF */
export type UserRole = 'Admin' | 'State Manager' | 'District Manager' | 'Area Manager' | 'CF' | 'JCF';

export interface AWDPipe {
  Pipe_ID: string;
  Batch_No: string;
  QR_URL: string;
  QR_Code?: string;
  Status: PipeStatus;
  Installation_Date?: string;
  Farmer_Name?: string;
  Village?: string;
  State?: string;
  District?: string;
  Year?: string;
  Specification?: string;
  Security_Hash?: string;
}

export interface Installation {
  Timestamp: string;
  Pipe_ID: string;
  Farmer_Name: string;
  Mobile: string;
  Farmer_ID?: string;
  Village: string;
  Mandal: string;
  District: string;
  State?: string;
  Survey_No?: string;
  Plot_Size: number;
  Plot_Size_Unit: PlotUnit;
  Crop: string;
  Variety?: string;
  Establishment_Method: EstablishmentMethod;
  Sowing_Transplantation_Date: string;
  Nursery_Sowing_Date?: string;
  Irrigation_Source: IrrigationSource;
  Irrigation_Source_Other?: string;
  Installation_Date: string;
  Latitude: number;
  Longitude: number;
  GPS_Accuracy: number;
  Location_Link: string;
  Installed_By: string;
  /** User ID of the CF/JCF who registered this — used for data scoping */
  Registered_By_User_ID?: string;
  /** Area manager user ID — used for area-level scoping */
  Area_Manager_User_ID?: string;
  Photo_URL?: string;
  Remarks?: string;
}

export interface MonitoringRecord {
  Timestamp: string;
  Pipe_ID: string;
  Visit_Date: string;
  Water_Level: string;
  Crop_Stage: CropStage;
  AWD_Followed: AWDFollowed;
  Pipe_Condition: PipeCondition;
  Visited_By: string;
  Visited_By_User_ID?: string;
  Latitude: number;
  Longitude: number;
  Photo_URL?: string;
  Remarks?: string;
}

export interface GPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
  /** Plain-text password for demo — in production use hashed + secure auth */
  password: string;
  role: UserRole;
  email: string;
  phone: string;
  isActive: boolean;
  /** State this user belongs to (State Manager and below) */
  state?: string;
  /** District this user belongs to (District Manager and below) */
  district?: string;
  /** Area name this user belongs to (Area Manager, CF, JCF) */
  areaName?: string;
  /** ID of the direct manager above this user */
  reportsToId?: string;
  /** Who created this user account */
  createdById?: string;
  createdAt?: string;
}

export interface StateNode {
  id: string;
  name: string;
  code: string;
  managerId?: string;
  managerName?: string;
}

export interface DistrictNode {
  id: string;
  stateId: string;
  stateName: string;
  name: string;
  managerId?: string;
  managerName?: string;
}

export interface AreaNode {
  id: string;
  districtId: string;
  districtName: string;
  stateName: string;
  name: string;
  managerId?: string;
  managerName?: string;
}

export interface OfflineQueueItem {
  id: string;
  timestamp: string;
  type: 'registration' | 'monitoring';
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
  payload: any;
}

