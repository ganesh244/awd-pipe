import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Archive, 
  RefreshCw, 
  Info,
  Wifi,
  WifiOff
} from 'lucide-react';

export type StatusType = 
  | 'Available' | 'Installed' | 'Damaged' | 'Removed' | 'Replaced' 
  | 'Good' | 'Warning' | 'Critical' | 'Pending' | 'Completed' 
  | 'Offline' | 'Online' | 'Registered';

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  let config = {
    colorClass: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: <Info className="w-3.5 h-3.5" />
  };

  switch (status) {
    case 'Available':
      config = { colorClass: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Info className="w-3.5 h-3.5" /> };
      break;
    case 'Installed':
    case 'Good':
    case 'Completed':
    case 'Online':
    case 'Registered':
      config = { colorClass: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
      break;
    case 'Warning':
    case 'Pending':
      config = { colorClass: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="w-3.5 h-3.5" /> };
      break;
    case 'Damaged':
    case 'Critical':
      config = { colorClass: 'bg-red-50 text-red-700 border-red-200', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
      break;
    case 'Removed':
    case 'Offline':
      config = { colorClass: 'bg-slate-50 text-slate-700 border-slate-300', icon: <Archive className="w-3.5 h-3.5" /> };
      break;
    case 'Replaced':
      config = { colorClass: 'bg-teal-50 text-teal-700 border-teal-200', icon: <RefreshCw className="w-3.5 h-3.5" /> };
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${config.colorClass} ${className}`}>
      {config.icon}
      {status}
    </span>
  );
};
