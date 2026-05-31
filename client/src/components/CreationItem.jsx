import React, { useState } from 'react'
import Markdown from 'react-markdown'


const CreationItem = ({item}) => {

    const[expanded, setExpanded] = useState(false);

  return (
    <div onClick={() => setExpanded(!expanded)} className='p-4 w-full text-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors shadow-lg h-full flex flex-col justify-between'>
        <div className='flex justify-between items-center gap-4'>
            <div>
                <h2 className='text-white font-semibold'>{item.prompt}</h2>
                <p className='text-slate-400'>{item.type} - {new Date(item.created_at).toLocaleDateString()}</p>
            </div>
            <button className='bg-blue-600/20 border border-blue-500/30 text-blue-300 px-4 py-1 rounded-full whitespace-nowrap'>{item.type}</button>
        </div>
        {
            expanded && (
                <div>
                    {item.type === 'image' ? (
                        <div>
                            <img src={item.content} alt="image" className='mt-4 w-full max-w-md rounded-lg shadow-xl' />
                        </div>
                    ) : (
                        <div className='mt-4 h-full overflow-y-scroll text-sm text-slate-300 bg-black/20 p-4 rounded-lg'>
                            <div className='reset-tw'>
                                <Markdown>
                                    {item.content}
                                </Markdown>
                            </div>
                        </div>
                    )
                    }
                </div>
            )
        }
    </div>
  )
}

export default CreationItem
