import { assets } from "../assets/assets"
import { dummyTestimonialData } from "../assets/assets"
import { motion } from "framer-motion"

const Testimonial = () => {
    return (
        <div className='px-4 sm:px-20 xl:px-32 py-32 bg-slate-950 relative overflow-hidden perspective-1000'>
            {/* Subtle background glow */}
            <div className="absolute bottom-[20%] left-[-5%] w-[30%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />

            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.8 }}
                className='text-center mb-16 relative z-10'
            >
                <h2 className='text-white text-4xl md:text-5xl font-bold tracking-tight'>Loved by Students & Educators</h2>
                <p className='text-slate-400 max-w-xl mx-auto mt-6 text-lg'>Don't just take our word for it. Here's what our campus community is saying.</p>
            </motion.div>
            
            <div className='flex flex-wrap justify-center items-stretch relative z-10' style={{ perspective: "1000px" }}>
                {dummyTestimonialData.map((testimonial, index) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        whileInView={{ opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: false, amount: 0.2 }}
                        transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                        key={index} 
                        className='p-8 m-4 w-full max-w-xs rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-2xl hover:bg-white/10'
                        style={{ transformStyle: "preserve-3d" }}
                    >
                        <div>
                            <div className="flex items-center gap-1 mb-6">
                                {Array(5).fill(0).map((_, index) => (<img key={index} 
                                src={index < testimonial.rating ? assets.star_icon : assets.star_dull_icon} className="w-4 h-4 brightness-125" alt='star' />))}
                            </div>
                            <p className='text-slate-300 text-sm leading-relaxed mb-8 italic'>"{testimonial.content}"</p>
                        </div>
                        
                        <div className='flex items-center gap-4 mt-auto border-t border-white/10 pt-6'>
                            <img src={testimonial.image} className='w-12 h-12 object-cover rounded-full shadow-lg' alt='' />
                            <div className='text-sm text-slate-200'>
                                <h3 className='font-bold'>{testimonial.name}</h3>
                                <p className='text-xs text-slate-400 mt-0.5'>{testimonial.title}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

export default Testimonial
