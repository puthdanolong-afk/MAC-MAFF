/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Member {
  id: string;
  name: string;
  contact: string;
  address: string;
  cropType?: string;
  plantingDate?: string;
  estimatedHarvestDate?: string;
  soilType?: string;
  activities?: {
    id: string;
    date: string;
    type: string;
    description: string;
    cost: number;
  }[];
  productionArea?: {
    type: "Feature";
    geometry: {
      type: "Polygon";
      coordinates: number[][][];
    };
    properties: Record<string, any>;
  };
  crops: string[];
  joinedAt: string;
  location?: {
    lat: number;
    lng: number;
  };
  status: 'active' | 'inactive' | 'pending';
}

export interface CropActivity {
  id: string;
  memberId: string;
  cropType: string;
  startDate: string;
  endDate?: string;
  activities: {
    date: string;
    type: string;
    description: string;
    cost: number;
  }[];
  estimatedYield: number;
  actualYield?: number;
  revenue?: number;
  status: "active" | "completed" | "planned";
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
}

export interface Sale {
  id: string;
  productId: string;
  buyerName: string;
  quantity: number;
  totalAmount: number;
  date: string;
}

export interface Loan {
  id: string;
  memberId: string;
  amount: number;
  interestRate: number;
  termMonths: number;
  startDate: string;
  status: "pending" | "approved" | "active" | "repaid" | "defaulted";
  payments: {
    date: string;
    amount: number;
    principal: number;
    interest: number;
  }[];
}

export interface Transaction {
  id: string;
  type: "income" | "expense" | "deposit" | "withdrawal";
  amount: number;
  description: string;
  date: string;
  category: string;
  referenceId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  type: "seed" | "fertilizer" | "pesticide" | "equipment" | "harvest";
  lastUpdated: string;
}
