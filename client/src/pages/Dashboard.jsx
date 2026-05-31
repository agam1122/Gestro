import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import CreationItem from '../components/CreationItem';
import axios from 'axios';
import toast from 'react-hot-toast';
import useCreationStore from '../store/useCreationStore';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const Dashboard = () => {

  const [loading, setLoading] = useState(true);

  const { creations, setCreations } = useCreationStore();

  const { getToken } = useAuth();

  const getDashboardData = async () => {
    try {

      setLoading(true);

      const { data } = await axios.get(
        "/api/user/get-user-documents",
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
      );

      if (data.success) {

        setCreations(data.data);

      } else {
        toast.error(data.message);
      }

    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }

    setLoading(false);
  }

  useEffect(() => {

    // only fetch if store empty
    if (creations.length === 0) {
      getDashboardData();
    } else {
      setLoading(false);
    }

  }, []);

  return (
    <div className='h-full overflow-y-scroll p-6'>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className='flex justify-start gap-4 flex-wrap'
      >

        <div className='flex justify-between items-center w-72 p-4 px-6 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 shadow-lg hover:bg-white/10 transition-colors'>

          <div className='text-slate-300'>
            <p className='text-sm'>Total Documents</p>
            <h2 className='text-2xl font-bold text-white'>
              {creations.length}
            </h2>
          </div>

          <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white flex justify-center items-center shadow-[0_0_15px_rgba(147,51,234,0.4)]'>
            <Sparkles className='w-6 h-6 text-white' />
          </div>

        </div>

      </motion.div>

      {loading ? (

        <div className="text-center p-10 text-slate-400">
          Loading documents...
        </div>

      ) : (

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className='space-y-3 mt-8'
        >

          <p className='mb-4 font-semibold text-slate-300'>
            Recent Documents
          </p>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {
              creations.map((item, index) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  key={item.id}
                >
                  <CreationItem item={item} />
                </motion.div>
              ))
            }
          </div>

        </motion.div>

      )}

    </div>
  )
}

export default Dashboard