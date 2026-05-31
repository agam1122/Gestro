import { create } from "zustand";

const useCreationStore = create((set) => ({

  creations: [],
  communityCreations: [],

  setCreations: (data) =>
    set({
      creations: data,
    }),

  setCommunityCreations: (data) =>
    set({
      communityCreations: data,
    }),

}));

export default useCreationStore;