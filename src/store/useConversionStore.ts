import { create } from "zustand";
import type { StateStorage } from "zustand/middleware";
import { persist, createJSONStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
import type { ImageItem } from "../types";
import { CACHE_EXPIRATION_MS } from "../common/constants";

// 1. Create a custom storage engine using IndexedDB
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const data = await get(name);
    return data || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface ConversionState {
  images: ImageItem[];
  addImages: (newImages: ImageItem[]) => void;
  updateImage: (id: string, updates: Partial<ImageItem>) => void;
  clearCompleted: () => void;
}

// 2. Create the Zustand Store
export const useConversionStore = create<ConversionState>()(
  persist(
    (set) => ({
      images: [],

      addImages: (newImages) =>
        set((state) => ({ images: [...state.images, ...newImages] })),

      updateImage: (id, updates) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === id ? { ...img, ...updates } : img,
          ),
        })),

      clearCompleted: () =>
        set((state) => ({
          images: state.images.filter((img) => img.status !== "Done"),
        })),
    }),
    {
      name: "ffmpeg-conversion-queue", // Unique name for the IndexedDB database
      storage: createJSONStorage(() => idbStorage),

      // 3. The Magic Step: Recreate URLs when the app reloads
      // Because IndexedDB stores the actual File/Blob, we just need to mint new URLs for them
      partialize: (state) => state, // Save everything
      merge: (persistedState: unknown, currentState) => {
        const savedState = persistedState as Partial<ConversionState>;

        if (!savedState || !savedState.images) return currentState;

        const currentTime = Date.now();

        const validImages = savedState.images.filter(
          (img: ImageItem) => currentTime - img.createdAt < CACHE_EXPIRATION_MS,
        );

        const revivedImages = validImages.map((img: ImageItem) => {
          // Recreate the preview URL from the saved File
          const freshPreviewUrl = URL.createObjectURL(img.file);

          let freshOutputUrl = img.outputUrl;
          if (img.status === "Done" && img.outputBlob) {
            freshOutputUrl = URL.createObjectURL(img.outputBlob);
          }

          return {
            ...img,
            previewUrl: freshPreviewUrl,
            outputUrl: freshOutputUrl,
            // If it was stuck converting during a refresh, reset it to pending
            status: img.status === "Converting" ? "Pending" : img.status,
            progress: img.status === "Converting" ? 0 : img.progress,
          };
        });

        return { ...currentState, images: revivedImages };
      },
    },
  ),
);
