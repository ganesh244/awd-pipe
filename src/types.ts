export type PipeStatus = 'Available' | 'Installed' | 'Damaged' | 'Removed' | 'Replaced';

export type EstablishmentMethod = 'Dry DSR' | 'Wet DSR' | 'TPR';

export type IrrigationSource = 'Borewell' | 'Canal' | 'Tank' | 'Other';

export type PlotUnit = 'Acres' | 'Hectares';

export type AWDFollowed = 'Yes' | 'No' | 'Partially';

export type PipeCondition = 'Good' | 'Damaged' | 'Missing' | 'Replaced';

export type CropStage = 'Tillering' | 'Panicle Initiation' | 'Flowering' | 'Grain Filling' | 'Harvesting' | 'Vegetative';

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
  Photo_URL?: string;
  Remarks?: string;
}

export interface MonitoringRecord {
  Timestamp: string;
  Pipe_ID: string;
  Visit_Date: string;
  Water_Level: string; // e.g. "-5 cm (Dry)", "+2 cm (Flooded)", "0 cm (Soil Surface)"
  Crop_Stage: CropStage;
  AWD_Followed: AWDFollowed;
  Pipe_Condition: PipeCondition;
  Visited_By: string;
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
