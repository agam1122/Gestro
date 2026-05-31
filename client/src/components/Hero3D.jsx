import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

const FloatingShapes = () => {
    const groupRef = useRef(null);

    // Slowly rotate the entire group
    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.15;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Purple Sphere */}
            <Float speed={2} rotationIntensity={1} floatIntensity={2} position={[-1.2, 0.8, 0]}>
                <mesh castShadow receiveShadow>
                    <sphereGeometry args={[0.7, 64, 64]} />
                    {/* Emissive color makes it glow with Bloom */}
                    <meshStandardMaterial color="#8b5cf6" emissive="#5b21b6" emissiveIntensity={0.5} roughness={0.1} metalness={0.2} />
                </mesh>
            </Float>

            {/* Blue Cube */}
            <Float speed={2.5} rotationIntensity={2} floatIntensity={1.5} position={[1.4, 0.2, 0.8]}>
                <mesh castShadow receiveShadow rotation={[Math.PI / 4, Math.PI / 4, 0]}>
                    <boxGeometry args={[1.1, 1.1, 1.1]} />
                    <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.4} roughness={0.2} metalness={0.1} />
                </mesh>
            </Float>

            {/* Pink Cone / Pyramid */}
            <Float speed={1.5} rotationIntensity={1.5} floatIntensity={2.5} position={[0.2, -1.2, -0.5]}>
                <mesh castShadow receiveShadow rotation={[-Math.PI / 6, 0, 0]}>
                    <coneGeometry args={[0.8, 1.6, 32]} />
                    <meshStandardMaterial color="#ec4899" emissive="#be185d" emissiveIntensity={0.5} roughness={0.15} metalness={0.25} />
                </mesh>
            </Float>
        </group>
    );
};

export default function Hero3D() {
    return (
        <div className="w-full h-[400px] md:h-[600px] flex items-center justify-center">
            <Canvas 
                camera={{ position: [0, 0, 7.5], fov: 45 }} 
                shadows 
                dpr={[1, 1.5]}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                gl={{ alpha: true, antialias: true }}
                onCreated={({ gl }) => {
                    gl.setClearColor(0x000000, 0); // Force perfectly transparent background
                }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight castShadow position={[5, 10, 5]} intensity={1.5} shadow-mapSize={[1024, 1024]} />
                
                <FloatingShapes />
                
                <EffectComposer disableNormalPass>
                    <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} opacity={1} />
                </EffectComposer>
                
                {/* Premium soft shadow underneath the shapes */}
                <ContactShadows position={[0, -2.5, 0]} opacity={0.5} scale={10} blur={3} far={4} color="#000000" />

                <OrbitControls 
                    enableZoom={false} 
                    enablePan={false}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                />
                <Environment preset="city" />
            </Canvas>
        </div>
    );
}
