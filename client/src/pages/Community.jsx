import React, { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react' // Import useUser
import { Heart } from 'lucide-react';
import axios from 'axios';
import { useAuth } from "@clerk/clerk-react";
import toast from 'react-hot-toast';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const Community = () => {
  
  const [creations, setCreations] = useState([]);
  // 💡 CHANGE HERE: Destructure 'user' directly from useUser()
  const { user, isLoaded } = useUser(); 
  const [loading, setLoading] = useState(true);

  const { getToken } = useAuth();

  // ... (fetchCreations and imageLikeToggle remain the same)
  const fetchCreations = async () => {
    
    try {
      setLoading(true);
      
      const { data: responseData } = await axios.get(
        "/api/user/get-published-creations",
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
      );
      
      if (responseData.success) {
          // Ensure that the 'likes' array is present on creation objects
          setCreations(responseData.data); 
      } else {
          setCreations([]); 
          toast.error(responseData.message);
      }
    } catch (error) {
      setCreations([]); 
      toast.error(error.response?.data?.message || error.message);
    }
    setLoading(false);
  }

  const imageLikeToggle = async (id) => {
    try {
      const { data: responseData } = await axios.post(
        "/api/user/toggle-like-creations",
        { id },
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
      );

      if (responseData.success) {
        toast.success(responseData.message);
        // Await the fetchCreations call to ensure state is updated before re-render
        await fetchCreations(); 
      } else {
        toast.error(responseData.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  useEffect(() => {
    // Only fetch if the user object is fully loaded and available
    if (isLoaded && user) {
      fetchCreations();
    }
  }, [isLoaded, user]) // Depend on isLoaded and user

  return (
    <div className='flex-1 h-full flex flex-col gap-4 p-6'>
      Creations
      {loading ? (
        <div className="text-center p-10">Loading creations...</div>
      ) : (
        <div className='bg-white h-full w-full rounded-xl overflow-y-scroll'>
          {creations.map((creation, index) => (
            <div key={index} className='relative group inline-block pl-3 pt-3 w-full sm:max-w-1/2 lg:max-w-1/3'>
              <img src={creation.content} alt="" className='w-full h-full object-cover rounded-lg' />

              <div className='absolute bottom-0 top-0 right-0 left-3 flex gap-2 items-end justify-end 
              group-hover:justify-between p-3 group-hover:bg-gradient-to-b from-transparent to-black/80 
              text-white rounded-lg'>
                <p className='text-sm hidden group-hover:block'>{creation.prompt}</p>
                <div className='flex gap-1 items-center'>
                  <p>{creation.likes.length}</p>
                  <Heart 
                    onClick={() => imageLikeToggle(creation.id)} 
                    className={`min-w-5 h-5 hover:scale-110 cursor-pointer 
                      ${user && creation.likes.includes(user.id) ? 'fill-red-500 text-red-600' : 'text-white'}`
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Community