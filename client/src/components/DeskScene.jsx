import React, { useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Float, Html } from '@react-three/drei'
import * as THREE from 'three'

// Smooth Camera Controller linked to Preset angles and OrbitControls target
const CameraController = ({ preset, controlsRef }) => {
  const { camera, size } = useThree()

  useFrame(() => {
    const targetPos = new THREE.Vector3(0, 4.5, 7.5)
    const targetLook = new THREE.Vector3(0, 1.2, 0)

    const aspect = size.width / size.height
    const isPortrait = aspect < 1.25
    // Scale camera distance on narrow screen aspect ratios to fit the 3D desk layout perfectly
    const zoomFactor = isPortrait ? Math.min(1.4, 1.15 / aspect) : 1

    if (preset === 'focus') {
      targetPos.set(0, 2.1 * zoomFactor, 3.2 * zoomFactor)
      targetLook.set(0, 1.25, 0)
    } else if (preset === 'desk') {
      targetPos.set(3.2 * zoomFactor, 3.2 * zoomFactor, 4.8 * zoomFactor)
      targetLook.set(0, 1.15, 0)
    } else if (preset === 'wide') {
      targetPos.set(-4.5 * zoomFactor, 5.5 * zoomFactor, 7.5 * zoomFactor)
      targetLook.set(0, 1.4, 0)
    } else if (preset === 'notebook') {
      // Pull back notebook preset slightly in portrait orientation to keep both pages inside the canvas
      targetPos.set(0.32, 1.55 * (isPortrait ? 1.12 : 1), 0.85 * (isPortrait ? 1.22 : 1))
      targetLook.set(0.32, 0.95, 0.42)
    }

    // Smoothly lerp camera position
    camera.position.lerp(targetPos, 0.05)

    // Smoothly lerp orbit target
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook, 0.05)
      controlsRef.current.update()
    }
  })

  return null
}

// Procedural Steam Particles rising from the Coffee Mug
const SteamParticles = ({ active }) => {
  const pointsRef = useRef()
  const particleCount = 20

  const particles = useRef(
    Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 0.1,
      y: Math.random() * 0.8,
      z: (Math.random() - 0.5) * 0.1,
      speed: 0.004 + Math.random() * 0.004,
      wobble: Math.random() * 100
    }))
  )

  useFrame((state) => {
    if (!pointsRef.current) return

    const geom = pointsRef.current.geometry
    const posAttr = geom.getAttribute('position')

    for (let i = 0; i < particleCount; i++) {
      const p = particles.current[i]
      if (active) {
        p.y += p.speed
        p.x += Math.sin(state.clock.elapsedTime * 2 + p.wobble) * 0.0008

        if (p.y > 0.8) {
          p.y = 0
          p.x = (Math.random() - 0.5) * 0.1
        }
      } else {
        p.y = -10 // Hide particles below the desk when disabled
      }

      posAttr.setXYZ(i, p.x + 0.75, p.y + 1.05, p.z - 0.25)
    }
    posAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(particleCount * 3), 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#f1f5f9"
        size={0.06}
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Animated controller component inside <Canvas> to handle R3F frame updates
const AnimatedWorkspace = ({
  fanOn,
  cameraPreset,
  chairTargetRotation,
  chairRef,
  plantRef,
  bladesRef,
  neonMatRef,
  wallLightRef,
  starsGroupRef,
  bookCoverRef,
  leftBookGroupRef
}) => {
  const fanSpeed = useRef(0.25)
  const chairRotation = useRef(0)
  const bookOpenAngle = useRef(0)

  useFrame((state) => {
    // 1. Chair spin spring interpolation
    chairRotation.current += (chairTargetRotation.current - chairRotation.current) * 0.08
    if (chairRef.current) {
      chairRef.current.rotation.y = chairRotation.current
    }

    // 2. Fan blade spinning speed interpolation
    const targetSpeed = fanOn ? 0.28 : 0
    fanSpeed.current += (targetSpeed - fanSpeed.current) * 0.05
    if (bladesRef.current) {
      bladesRef.current.rotation.z += fanSpeed.current
    }

    // 3. Succulent gentle swaying
    if (plantRef.current) {
      plantRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.04
      plantRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 1.0) * 0.02
    }

    // 4. Neon Backlight emissive breathing
    if (neonMatRef.current) {
      neonMatRef.current.emissiveIntensity = 1.5 + Math.sin(state.clock.elapsedTime * 2.0) * 0.5
    }

    // 5. Backlight PointLight wall wash intensity pulsing
    if (wallLightRef.current) {
      wallLightRef.current.intensity = 1.2 + Math.sin(state.clock.elapsedTime * 2.0) * 0.4
    }

    // 6. Twinkling stars in the background
    if (starsGroupRef.current) {
      starsGroupRef.current.children.forEach((child, index) => {
        child.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3.5 + index) * 0.3)
      })
    }

    // 7. Book opening cover rotation and left side scale-up
    const targetAngle = (cameraPreset === 'notebook') ? -Math.PI * 0.98 : 0
    bookOpenAngle.current += (targetAngle - bookOpenAngle.current) * 0.08
    
    if (bookCoverRef.current) {
      bookCoverRef.current.rotation.y = bookOpenAngle.current
    }

    if (leftBookGroupRef.current) {
      const progress = Math.abs(bookOpenAngle.current) / Math.PI
      leftBookGroupRef.current.scale.set(progress, progress, progress)
    }
  })

  return null
}

const DeskScene = ({ pointerEventsClass = '', cameraPreset, setCameraPreset, lampOn, setLampOn, coffeeSteam, setCoffeeSteam, timerText, timerStatus, timeLeft, totalDuration, notes }) => {
  const controlsRef = useRef()

  // Interactive/animated refs & state
  const [fanOn, setFanOn] = useState(true)
  const chairTargetRotation = useRef(0)

  const chairRef = useRef()
  const plantRef = useRef()
  const bladesRef = useRef()
  const neonMatRef = useRef()
  const wallLightRef = useRef()
  const starsGroupRef = useRef()
  const bookCoverRef = useRef()
  const leftBookGroupRef = useRef()

  return (
    <div className={`w-full h-full relative ${pointerEventsClass}`}>
      <Canvas
        shadows
        camera={{ position: [0, 4.5, 7.5], fov: 45 }}
        className="w-full h-full bg-slate-950/60 rounded-3xl"
      >
        <ambientLight intensity={lampOn ? 0.55 : 0.25} color="#e2e8f0" />
        
        {/* Ambient room directional light */}
        <directionalLight
          position={[5, 10, 4]}
          intensity={0.4}
          color="#93c5fd"
        />

        {/* High-contrast secondary fill light (indigo/violet) */}
        <directionalLight
          position={[-6, 8, -2]}
          intensity={0.25}
          color="#818cf8"
        />

        {/* Floating background glowing dust/stars & neon rings */}
        <Float speed={2.5} rotationIntensity={1.2} floatIntensity={1.5}>
          <group position={[0, 3, -4]}>
            {/* Soft glowing ambient circle */}
            <mesh>
              <ringGeometry args={[2.5, 2.55, 64]} />
              <meshBasicMaterial color="#a78bfa" transparent opacity={0.15} side={THREE.DoubleSide} />
            </mesh>
            {/* Cyberpunk floating neon rings */}
            <mesh position={[2.5, 1.8, -1]} rotation={[1, 1, 0.5]}>
              <torusGeometry args={[0.35, 0.012, 8, 32]} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.35} wireframe />
            </mesh>
            <mesh position={[-2.8, -0.5, -1.5]} rotation={[0.4, -0.4, 1.2]}>
              <torusGeometry args={[0.22, 0.008, 8, 32]} />
              <meshBasicMaterial color="#ec4899" transparent opacity={0.3} wireframe />
            </mesh>
            
            <mesh position={[2, 1.5, -2]}>
              <sphereGeometry args={[0.04, 16, 16]} />
              <meshBasicMaterial color="#60a5fa" transparent opacity={0.65} />
            </mesh>
            <mesh position={[-2.5, -1, -1]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshBasicMaterial color="#ec4899" transparent opacity={0.45} />
            </mesh>
            <mesh position={[1.2, -1.8, -2.5]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshBasicMaterial color="#a78bfa" transparent opacity={0.55} />
            </mesh>
          </group>
        </Float>

        {/* Room Cozy Window Frame & Moon/Stars View */}
        <group position={[0, 2.5, -5.5]}>
          {/* Wooden Window Borders */}
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[2.5, 0.06, 0.1]} /> {/* Top */}
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <boxGeometry args={[2.5, 0.06, 0.1]} /> {/* Bottom */}
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
          <mesh position={[-1.22, 0, 0]}>
            <boxGeometry args={[0.06, 1.86, 0.1]} /> {/* Left */}
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
          <mesh position={[1.22, 0, 0]}>
            <boxGeometry args={[0.06, 1.86, 0.1]} /> {/* Right */}
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
          
          {/* Inner Dividers */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.03, 1.8, 0.08]} /> {/* Vertical grates */}
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[2.4, 0.03, 0.08]} /> {/* Horizontal grates */}
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>

          {/* Twinkling Star field */}
          <group ref={starsGroupRef} position={[0, 0, -1.5]}>
            <mesh position={[-0.8, 0.5, 0]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.4, 0.7, 0]}>
              <sphereGeometry args={[0.01, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.9, -0.3, 0]}>
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.6, -0.5, 0]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.9, 0.4, 0]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.3, 0.8, 0]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.8, -0.6, 0]}>
              <sphereGeometry args={[0.011, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.2, -0.7, 0]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>

          {/* Crescent Moon */}
          <group position={[0.7, 0.5, -1.4]}>
            {/* Main Moon Sphere */}
            <mesh>
              <sphereGeometry args={[0.16, 24, 24]} />
              <meshBasicMaterial color="#fef08a" />
            </mesh>
            {/* Dark Shadow sphere creating the Crescent shape */}
            <mesh position={[-0.08, 0.04, 0.05]}>
              <sphereGeometry args={[0.165, 24, 24]} />
              <meshBasicMaterial color="#020617" />
            </mesh>
          </group>
        </group>

        {/* Desk Table Group */}
        <group position={[0, -0.6, 0]}>
          
          {/* Table Top */}
          <mesh receiveShadow castShadow position={[0, 0.9, 0]}>
            <boxGeometry args={[3.2, 0.1, 1.8]} />
            <meshStandardMaterial
              color="#334155"
              roughness={0.4}
              metalness={0.2}
            />
          </mesh>

          {/* Table Legs */}
          <mesh castShadow position={[-1.4, 0.45, 0.7]}>
            <cylinderGeometry args={[0.04, 0.03, 0.9]} />
            <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh castShadow position={[1.4, 0.45, 0.7]}>
            <cylinderGeometry args={[0.04, 0.03, 0.9]} />
            <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh castShadow position={[-1.4, 0.45, -0.7]}>
            <cylinderGeometry args={[0.04, 0.03, 0.9]} />
            <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh castShadow position={[1.4, 0.45, -0.7]}>
            <cylinderGeometry args={[0.04, 0.03, 0.9]} />
            <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.8} />
          </mesh>

          {/* Desk Mat */}
          <mesh position={[0, 0.951, 0.12]} receiveShadow>
            <boxGeometry args={[2.0, 0.005, 0.72]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>

          {/* Keyboard & Mouse */}
          <group position={[0, 0.953, 0.18]}>
            {/* Keyboard Base Board */}
            <mesh castShadow position={[0, 0.008, 0]}>
              <boxGeometry args={[0.82, 0.015, 0.24]} />
              <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.5} />
            </mesh>
            {/* Glowing bottom edge strip */}
            <mesh position={[0, 0.001, 0]}>
              <boxGeometry args={[0.84, 0.004, 0.26]} />
              <meshBasicMaterial color={
                timerStatus === 'study' ? '#ec4899' :
                timerStatus === 'shortBreak' ? '#059669' : '#2563eb'
              } transparent opacity={0.35} />
            </mesh>
            {/* Keycap bed area */}
            <mesh position={[0, 0.016, 0.005]}>
              <boxGeometry args={[0.78, 0.005, 0.20]} />
              <meshStandardMaterial color="#020617" roughness={0.9} />
            </mesh>
            {/* Visual key columns */}
            {[-0.34, -0.22, -0.1, 0.02, 0.14, 0.26, 0.34].map((xVal, i) => (
              <mesh key={i} position={[xVal, 0.02, 0]}>
                <boxGeometry args={[0.06, 0.005, 0.17]} />
                <meshStandardMaterial color="#334155" roughness={0.7} />
              </mesh>
            ))}

            {/* Ergonomic Mouse */}
            <group position={[0.55, 0.01, -0.02]}>
              <mesh castShadow scale={[1, 0.65, 1.5]}>
                <sphereGeometry args={[0.045, 16, 16]} />
                <meshStandardMaterial color="#1e293b" roughness={0.4} />
              </mesh>
              {/* Mouse scroll wheel */}
              <mesh position={[0, 0.028, -0.025]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.008, 0.008, 0.008, 8]} />
                <meshStandardMaterial color={
                  timerStatus === 'study' ? '#ec4899' :
                  timerStatus === 'shortBreak' ? '#059669' : '#2563eb'
                } />
              </mesh>
            </group>
          </group>

          {/* Lofi Study Chair */}
          <group 
            ref={chairRef} 
            position={[0, 0, 1.15]} 
            onClick={(e) => {
              e.stopPropagation()
              chairTargetRotation.current += Math.PI * 2
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { document.body.style.cursor = 'default' }}
          >
            {/* Base spokes */}
            {[0, 72, 144, 216, 288].map((angle, i) => (
              <mesh key={i} rotation={[0, (angle * Math.PI) / 180, 0]} position={[0, 0.05, 0]} castShadow>
                <boxGeometry args={[0.35, 0.02, 0.04]} />
                <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
              </mesh>
            ))}
            {/* Wheels (little spheres on ends of spokes) */}
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180
              return (
                <mesh key={i} position={[Math.sin(rad) * 0.175, 0.025, Math.cos(rad) * 0.175]} castShadow>
                  <sphereGeometry args={[0.025, 8, 8]} />
                  <meshStandardMaterial color="#020617" roughness={0.9} />
                </mesh>
              )
            })}
            {/* Hydraulic spindle */}
            <mesh position={[0, 0.22, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.34, 16]} />
              <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Cushion seat */}
            <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.56, 0.07, 0.52]} />
              <meshStandardMaterial color="#1e293b" roughness={0.7} />
            </mesh>
            {/* Armrest supports & Armrests */}
            <mesh position={[-0.29, 0.54, 0.05]} castShadow>
              <boxGeometry args={[0.02, 0.25, 0.03]} />
              <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.2} />
            </mesh>
            <mesh position={[0.29, 0.54, 0.05]} castShadow>
              <boxGeometry args={[0.02, 0.25, 0.03]} />
              <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.2} />
            </mesh>
            <mesh position={[-0.29, 0.665, 0.08]} castShadow>
              <boxGeometry args={[0.03, 0.02, 0.22]} />
              <meshStandardMaterial color="#0f172a" roughness={0.6} />
            </mesh>
            <mesh position={[0.29, 0.665, 0.08]} castShadow>
              <boxGeometry args={[0.03, 0.02, 0.22]} />
              <meshStandardMaterial color="#0f172a" roughness={0.6} />
            </mesh>
            {/* Backrest Support Steel Bar */}
            <mesh position={[0, 0.58, -0.22]} rotation={[0.15, 0, 0]} castShadow>
              <boxGeometry args={[0.06, 0.38, 0.025]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Backrest Cushion */}
            <mesh position={[0, 0.78, -0.26]} rotation={[0.08, 0, 0]} castShadow>
              <boxGeometry args={[0.52, 0.38, 0.05]} />
              <meshStandardMaterial color="#1e293b" roughness={0.7} />
            </mesh>
          </group>

          {/* Rear Neon Backlight Strip */}
          <mesh position={[0, 0.952, -0.85]}>
            <boxGeometry args={[3.12, 0.016, 0.03]} />
            <meshStandardMaterial
              ref={neonMatRef}
              color={
                timerStatus === 'study' ? '#ec4899' :
                timerStatus === 'shortBreak' ? '#059669' : '#2563eb'
              }
              emissive={
                timerStatus === 'study' ? '#ec4899' :
                timerStatus === 'shortBreak' ? '#059669' : '#2563eb'
              }
              emissiveIntensity={1.5}
            />
          </mesh>

          {/* Faint ambient wall-wash pointLight behind desk */}
          <pointLight
            ref={wallLightRef}
            position={[0, 1.25, -0.95]}
            intensity={1.2}
            distance={3.5}
            color={
              timerStatus === 'study' ? '#ec4899' :
              timerStatus === 'shortBreak' ? '#059669' : '#2563eb'
            }
          />

          {/* Spinning Retro Desk Fan */}
          <group position={[-0.65, 0.95, 0.35]}>
            {/* Fan Base */}
            <mesh 
              castShadow 
              onClick={(e) => {
                e.stopPropagation()
                setFanOn(!fanOn)
              }} 
              onPointerOver={() => { document.body.style.cursor = 'pointer' }}
              onPointerOut={() => { document.body.style.cursor = 'default' }}
              position={[0, 0.015, 0]}
            >
              <cylinderGeometry args={[0.08, 0.09, 0.03, 24]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.2} />
            </mesh>
            {/* Button switch on base */}
            <mesh position={[0, 0.032, 0.045]}>
              <cylinderGeometry args={[0.012, 0.012, 0.01, 8]} />
              <meshBasicMaterial color={fanOn ? '#ef4444' : '#475569'} />
            </mesh>
            {/* Fan Stem / Neck */}
            <mesh position={[0, 0.14, -0.025]} rotation={[0.2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.015, 0.018, 0.22, 16]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Fan Motor Box behind cage */}
            <mesh position={[0, 0.26, -0.05]} castShadow>
              <cylinderGeometry args={[0.045, 0.045, 0.08, 16]} rotation={[Math.PI / 2, 0, 0]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.2} />
            </mesh>
            {/* Torus wireframe protective cage */}
            <mesh position={[0, 0.26, 0.015]}>
              <torusGeometry args={[0.13, 0.005, 8, 32]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.1} />
            </mesh>
            <mesh position={[0, 0.26, 0.015]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.13, 0.005, 8, 32]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.1} />
            </mesh>
            {/* Inner fan blades */}
            <group ref={bladesRef} position={[0, 0.26, 0.012]}>
              {[0, 90, 180, 270].map((angle, idx) => (
                <mesh key={idx} rotation={[0, 0, (angle * Math.PI) / 180]}>
                  <boxGeometry args={[0.025, 0.11, 0.004]} position={[0, 0.055, 0]} />
                  <meshStandardMaterial color="#b45309" metalness={0.6} roughness={0.3} />
                </mesh>
              ))}
              {/* Blade center cap */}
              <mesh position={[0, 0, 0.005]}>
                <sphereGeometry args={[0.02, 16, 16]} />
                <meshStandardMaterial color="#d97706" metalness={0.8} roughness={0.1} />
              </mesh>
            </group>
          </group>

          {/* Potted Desk Succulent */}
          <group position={[-1.25, 0.95, 0.2]}>
            {/* Terracotta Clay Pot */}
            <mesh castShadow position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.065, 0.045, 0.16, 16]} />
              <meshStandardMaterial color="#d97706" roughness={0.8} />
            </mesh>
            {/* Soil inside pot */}
            <mesh position={[0, 0.155, 0]}>
              <cylinderGeometry args={[0.061, 0.061, 0.01, 16]} />
              <meshStandardMaterial color="#451a03" roughness={0.9} />
            </mesh>
            {/* Organic plant leaves group */}
            <group ref={plantRef} position={[0, 0.16, 0]}>
              {/* Center core */}
              <mesh position={[0, 0.02, 0]} castShadow>
                <sphereGeometry args={[0.022, 12, 12]} />
                <meshStandardMaterial color="#10b981" roughness={0.6} />
              </mesh>
              {/* Ring 1 - inner leaves */}
              {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                const rad = (angle * Math.PI) / 180
                const x = Math.sin(rad) * 0.03
                const z = Math.cos(rad) * 0.03
                return (
                  <mesh 
                    key={i} 
                    position={[x, 0.015, z]} 
                    rotation={[0.25, rad, 0]}
                    castShadow
                  >
                    <sphereGeometry args={[0.02, 8, 8]} scale={[1, 0.4, 1.8]} />
                    <meshStandardMaterial color="#059669" roughness={0.5} />
                  </mesh>
                )
              })}
              {/* Ring 2 - outer leaves */}
              {[30, 90, 150, 210, 270, 330].map((angle, i) => {
                const rad = (angle * Math.PI) / 180
                const x = Math.sin(rad) * 0.045
                const z = Math.cos(rad) * 0.045
                return (
                  <mesh 
                    key={i} 
                    position={[x, 0.008, z]} 
                    rotation={[0.45, rad, 0]}
                    castShadow
                  >
                    <sphereGeometry args={[0.026, 8, 8]} scale={[1.2, 0.4, 2.0]} />
                    <meshStandardMaterial color="#047857" roughness={0.5} />
                  </mesh>
                )
              })}
            </group>
          </group>

          {/* Interactive 3D Study Notebook */}
          <group 
            position={[0.35, 0.95, 0.42]} 
            rotation={[0, -0.15, 0]}
            onClick={(e) => {
              e.stopPropagation()
              setCameraPreset('notebook')
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { document.body.style.cursor = 'default' }}
          >
            {/* Spine Binder */}
            <mesh castShadow position={[0, 0.008, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.44, 16]} rotation={[Math.PI / 2, 0, 0]} />
              <meshStandardMaterial color="#451a03" roughness={0.5} metalness={0.2} />
            </mesh>

            {/* Fixed Right Side (Back cover & right pages) */}
            {/* Back Cover */}
            <mesh castShadow position={[0.085, 0.003, 0]}>
              <boxGeometry args={[0.17, 0.01, 0.44]} />
              <meshStandardMaterial color="#78350f" roughness={0.6} metalness={0.1} />
            </mesh>
            {/* Right Page Stack */}
            <mesh castShadow position={[0.08, 0.012, 0]}>
              <boxGeometry args={[0.16, 0.01, 0.42]} />
              <meshStandardMaterial color="#fefcbf" roughness={0.8} /> {/* Cream paper */}
            </mesh>

            {/* Dynamic Left Side (Left cover & left pages) - Scaled inside useFrame */}
            <group ref={leftBookGroupRef}>
              {/* Left Cover */}
              <mesh castShadow position={[-0.085, 0.003, 0]}>
                <boxGeometry args={[0.17, 0.01, 0.44]} />
                <meshStandardMaterial color="#78350f" roughness={0.6} metalness={0.1} />
              </mesh>
              {/* Left Page Stack */}
              <mesh castShadow position={[-0.08, 0.012, 0]}>
                <boxGeometry args={[0.16, 0.01, 0.42]} />
                <meshStandardMaterial color="#fefcbf" roughness={0.8} /> {/* Cream paper */}
              </mesh>
            </group>

            {/* Rotating Cover Flap */}
            <group ref={bookCoverRef} position={[0, 0.02, 0]}>
              {/* Front Cover Flap */}
              <mesh castShadow position={[0.085, 0.003, 0]}>
                <boxGeometry args={[0.17, 0.01, 0.44]} />
                <meshStandardMaterial color="#78350f" roughness={0.6} metalness={0.1} />
              </mesh>
            </group>

            {/* Projected Notes Content inside open pages */}
            {cameraPreset === 'notebook' && (
              <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.32, 0.42]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                <Html
                  transform
                  occlude
                  distanceFactor={0.42}
                  position={[0, 0, 0.001]}
                  className="select-none"
                >
                  <div 
                    onMouseDown={(e) => e.stopPropagation()} 
                    onWheel={(e) => e.stopPropagation()}
                    className="w-[270px] h-[350px] flex p-2.5 font-serif text-slate-950 leading-relaxed justify-between select-none relative"
                  >
                    <style>{`
                      .cozy-scrollbar::-webkit-scrollbar {
                        width: 3.5px;
                      }
                      .cozy-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                      }
                      .cozy-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(120, 53, 15, 0.35);
                        border-radius: 4px;
                      }
                      .cozy-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(120, 53, 15, 0.55);
                      }
                    `}</style>
                    
                    {/* Left Page notes */}
                    <div className="w-[122px] h-full flex flex-col border-r border-amber-900/15 pr-1.5 overflow-hidden">
                      <h5 className="text-[12px] font-extrabold border-b border-amber-900/15 pb-1 mb-1 text-amber-950 uppercase tracking-widest">
                        Notes
                      </h5>
                      <p className="whitespace-pre-wrap overflow-y-auto pr-1 cozy-scrollbar text-[11.5px] font-bold leading-[1.4em] text-slate-900 h-[290px]">
                        {notes ? notes.substring(0, Math.ceil(notes.length / 2)) : "Start writing notes in the sidebar journal..."}
                      </p>
                    </div>
                    {/* Right Page notes */}
                    <div className="w-[122px] h-full flex flex-col pl-1.5 overflow-hidden">
                      <h5 className="text-[12px] font-extrabold border-b border-amber-900/15 pb-1 mb-1 text-amber-950 uppercase tracking-widest text-right">
                        Journal
                      </h5>
                      <p className="whitespace-pre-wrap overflow-y-auto pr-1 cozy-scrollbar text-[11.5px] font-bold leading-[1.4em] text-slate-900 h-[290px]">
                        {notes && notes.length > 0 ? notes.substring(Math.ceil(notes.length / 2)) : ""}
                      </p>
                    </div>
                  </div>
                </Html>
              </mesh>
            )}

            {/* 3D Floating Tooltip (Bouncing helper label above closed book) */}
            {cameraPreset !== 'notebook' && (
              <Html
                position={[0.08, 0.08, 0]}
                center
                distanceFactor={1.15}
                className="pointer-events-none select-none animate-bounce"
              >
                <div className="px-2 py-1 bg-slate-900/90 backdrop-blur-md text-white border border-amber-500/40 rounded-lg text-[8px] font-bold tracking-wider uppercase flex items-center gap-1.5 whitespace-nowrap shadow-lg select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  📝 Open Journal
                </div>
              </Html>
            )}
          </group>

          {/* Computer/Monitor ( central focus screen ) */}
          <group position={[0, 0.95, -0.4]}>
            {/* Monitor Base stand */}
            <mesh castShadow position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.3]} />
              <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.2} />
            </mesh>
            <mesh castShadow position={[0, 0.01, 0.05]}>
              <boxGeometry args={[0.4, 0.02, 0.25]} />
              <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.2} />
            </mesh>
            
            {/* Monitor Bezel */}
            <mesh castShadow position={[0, 0.55, 0]}>
              <boxGeometry args={[1.5, 0.9, 0.05]} />
              <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.3} />
            </mesh>

            {/* Monitor Display Screen (Drei HTML layer for dynamic rendering) */}
            <mesh position={[0, 0.55, 0.026]}>
              <planeGeometry args={[1.45, 0.85]} />
              <meshBasicMaterial color="#020617" />
              <Html
                transform
                occlude
                distanceFactor={1.15}
                position={[0, 0, 0.005]}
                className="pointer-events-none select-none"
              >
                <div className="w-[450px] h-[264px] bg-slate-950/95 rounded-2xl flex flex-col items-center justify-center border border-white/5 shadow-inner">
                  <div className="flex flex-col items-center gap-3.5">
                    <p className={`text-[8px] font-bold uppercase tracking-[0.3em] duration-300 ${
                      timerStatus === 'study' ? 'text-red-400' :
                      timerStatus === 'shortBreak' ? 'text-emerald-400' : 'text-blue-400'
                    }`}>
                      {timerStatus === 'study' ? '— Focus Session —' :
                       timerStatus === 'shortBreak' ? '— Short Break —' : '— Long Break —'}
                    </p>
                    
                    {/* SVG Circular Progress Ring */}
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90 absolute inset-0" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id="monitorTimerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={
                              timerStatus === 'study' ? '#ec4899' :
                              timerStatus === 'shortBreak' ? '#059669' : '#2563eb'
                            } />
                            <stop offset="100%" stopColor={
                              timerStatus === 'study' ? '#ef4444' :
                              timerStatus === 'shortBreak' ? '#34d399' : '#60a5fa'
                            } />
                          </linearGradient>
                        </defs>
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="rgba(255,255,255,0.03)"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="url(#monitorTimerGrad)"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray="251.32"
                          strokeDashoffset={251.32 * (1 - (totalDuration ? (timeLeft / totalDuration) : 1))}
                          strokeLinecap="round"
                          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                        />
                      </svg>
                      <div className="text-center z-10">
                        <h1 className="text-3xl font-bold font-mono text-white tracking-tight leading-none">
                          {timerText}
                        </h1>
                        <p className="text-[7px] text-slate-500 font-semibold tracking-widest uppercase mt-1">
                          Remaining
                        </p>
                      </div>
                    </div>
                    
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/5 rounded-full border border-white/10">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        timerStatus === 'study' ? 'bg-red-500 animate-pulse' :
                        timerStatus === 'shortBreak' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500 animate-pulse'
                      }`} />
                      <span className="text-[7px] font-bold text-slate-400 tracking-wider uppercase">
                        {timerStatus === 'study' ? 'Studying' : 'Resting'}
                      </span>
                    </div>
                  </div>
                </div>
              </Html>
            </mesh>
          </group>

          {/* Golden Desk Lamp (Interactive spotlight) */}
          <group position={[-1.0, 0.95, -0.2]}>
            {/* Lamp base */}
            <mesh 
              castShadow 
              onClick={() => setLampOn(!lampOn)} 
              onPointerOver={() => { document.body.style.cursor = 'pointer' }}
              onPointerOut={() => { document.body.style.cursor = 'default' }}
              className="cursor-pointer" 
              position={[0, 0.02, 0]}
            >
              <cylinderGeometry args={[0.1, 0.1, 0.04, 32]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.15} />
            </mesh>
            {/* Lamp neck */}
            <mesh position={[0, 0.35, 0.05]}>
              <cylinderGeometry args={[0.015, 0.015, 0.7, 16]} />
              <meshStandardMaterial color="#475569" roughness={0.5} />
            </mesh>
            {/* Lamp arm */}
            <mesh position={[0.15, 0.7, 0.15]} rotation={[0.4, 0, -0.4]}>
              <cylinderGeometry args={[0.015, 0.015, 0.4, 16]} />
              <meshStandardMaterial color="#475569" roughness={0.5} />
            </mesh>
            
            {/* Lamp Shade */}
            <group position={[0.3, 0.8, 0.25]} rotation={[0, 0, 0.55]}>
              <mesh>
                <cylinderGeometry args={[0.08, 0.16, 0.2, 32]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.15} />
              </mesh>
              {/* Emissive bulb */}
              <mesh position={[0, -0.09, 0]}>
                <sphereGeometry args={[0.05, 16, 16]} />
                <meshBasicMaterial color={lampOn ? '#fef08a' : '#475569'} />
              </mesh>
              
              {/* Local PointLight to illuminate the bulb region */}
              {lampOn && (
                <pointLight
                  intensity={4.5}
                  distance={2.5}
                  position={[0, -0.1, 0]}
                  color="#fef08a"
                />
              )}

              {/* Actual SpotLight casting shadow onto desk */}
              {lampOn && (
                <spotLight
                  castShadow
                  intensity={16.0}
                  distance={3.5}
                  angle={0.65}
                  penumbra={0.6}
                  position={[0, -0.18, 0]}
                  target-position={[0.3, -1.0, 0]}
                  color="#fef08a"
                  shadow-mapSize-width={1024}
                  shadow-mapSize-height={1024}
                />
              )}
            </group>
          </group>

          {/* Coffee Mug (Interactive particle steam source) */}
          <group position={[0.75, 0.95, -0.25]}>
            {/* Mug Body */}
            <mesh
              castShadow
              onClick={() => setCoffeeSteam(!coffeeSteam)}
              onPointerOver={() => { document.body.style.cursor = 'pointer' }}
              onPointerOut={() => { document.body.style.cursor = 'default' }}
              className="cursor-pointer"
              position={[0, 0.1, 0]}
            >
              <cylinderGeometry args={[0.08, 0.08, 0.2, 32]} />
              <meshStandardMaterial color="#ec4899" roughness={0.3} />
            </mesh>
            {/* Mug Handle */}
            <mesh position={[0.09, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.04, 0.015, 8, 24, Math.PI]} />
              <meshStandardMaterial color="#ec4899" roughness={0.3} />
            </mesh>
            {/* Dark coffee inside */}
            <mesh position={[0, 0.19, 0]}>
              <cylinderGeometry args={[0.075, 0.075, 0.01, 16]} />
              <meshStandardMaterial color="#451a03" roughness={0.8} />
            </mesh>
            {/* Steam system */}
            <SteamParticles active={coffeeSteam} />
          </group>

          {/* Books Stack */}
          <group position={[0.8, 0.95, 0.3]} rotation={[0, -0.3, 0]}>
            {/* Book 1 (Bottom, Gold) */}
            <mesh castShadow position={[0, 0.04, 0]}>
              <boxGeometry args={[0.45, 0.08, 0.35]} />
              <meshStandardMaterial color="#b45309" roughness={0.3} />
            </mesh>
            {/* Book 2 (Middle, Violet) */}
            <mesh castShadow position={[-0.02, 0.1, 0.02]} rotation={[0, 0.25, 0]}>
              <boxGeometry args={[0.42, 0.07, 0.32]} />
              <meshStandardMaterial color="#6d28d9" roughness={0.4} />
            </mesh>
            {/* Book 3 (Top, Blue) */}
            <mesh castShadow position={[0.01, 0.16, -0.01]} rotation={[0, -0.15, 0]}>
              <boxGeometry args={[0.38, 0.06, 0.3]} />
              <meshStandardMaterial color="#1d4ed8" roughness={0.3} />
            </mesh>
          </group>
        </group>

        {/* Invisible desk floor to catch shadows */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]} receiveShadow>
          <planeGeometry args={[15, 15]} />
          <shadowMaterial opacity={0.25} />
        </mesh>

        {/* Glowing perspective wireframe grid on floor */}
        <gridHelper 
          args={[20, 20, '#6366f1', '#1e1b4b']} 
          position={[0, -0.61, 0]} 
          opacity={0.18} 
          transparent 
        />

        <CameraController preset={cameraPreset} controlsRef={controlsRef} />

        <AnimatedWorkspace
          fanOn={fanOn}
          cameraPreset={cameraPreset}
          chairTargetRotation={chairTargetRotation}
          chairRef={chairRef}
          plantRef={plantRef}
          bladesRef={bladesRef}
          neonMatRef={neonMatRef}
          wallLightRef={wallLightRef}
          starsGroupRef={starsGroupRef}
          bookCoverRef={bookCoverRef}
          leftBookGroupRef={leftBookGroupRef}
        />
        
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          maxPolarAngle={Math.PI / 2 - 0.05} // Don't let camera go below floor level
          minDistance={2.5}
          maxDistance={12}
        />
      </Canvas>
    </div>
  )
}

export default DeskScene
