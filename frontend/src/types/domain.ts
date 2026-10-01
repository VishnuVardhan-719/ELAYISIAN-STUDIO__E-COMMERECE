export interface User {
  id: string;
  name: string;
  email: string;
  role: "customer" | "creator" | "admin";
  creatorId?: string;
}
export interface Category {
  id: string;
  name: string;
  image: string;
  description: string;
}
export interface Creator {
  id: string;
  name: string;
  studio: string;
  specialty: string;
  location: string;
  bio: string;
  image: string;
  cover: string;
  since: number;
}
export interface Inventory {
  productId: string;
  stock: number;
}
export interface Product {
  id: string;
  name: string;
  creatorId: string;
  categoryId: string;
  price: number;
  images: string[];
  description: string;
  material: string;
  dimensions: string;
  stock: number;
  status: "active" | "draft";
  featured?: boolean;
}
export interface Collection {
  slug: string;
  name: string;
  description: string;
  image: string;
  productIds: string[];
}
export interface Collaboration {
  id: string;
  creatorName: string;
  email: string;
  categoryId: string;
  description: string;
  status: "pending" | "approved" | "declined";
  date: string;
}
export interface CollaborationInput {
  name: string;
  email: string;
  categoryId: string;
  portfolio: string;
  description: string;
  reason: string;
  sample: string;
  terms: boolean;
}
export interface CartItem {
  productId: string;
  quantity: number;
}
export interface Cart {
  userId: string;
  items: CartItem[];
}
export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}
export interface Order {
  id: string;
  userId: string;
  date: string;
  items: OrderItem[];
  total: number;
  status: "Delivered" | "In transit" | "Processing";
}
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  status: "Recorded demo";
}
export interface Address {
  id: string;
  userId?: string;
  name: string;
  line: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
}
export interface ProductFilters {
  search?: string;
  category?: string;
  maxPrice?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  pages: number;
  page: number;
}
