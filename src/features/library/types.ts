export type Folder = {
  id: number;
  path: string;
  parent_id: number | null;
  added_at: string;
  photo_count: number;
};

export type Photo = {
  id: number;
  folder_id: number;
  file_path: string;
  file_name: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  capture_date: string | null;
  camera_make: string | null;
  camera_model: string | null;
  rating: number;
  imported_at: string;
  thumbnail_path: string | null;
};
