import Home from './pages/Home'
import Onboarding from './pages/Onboarding'
import Layout from './pages/Layout'
import Dashboard from './pages/Dashboard'
import GenerateQuestionPaper from './pages/GenerateQuestionPaper'
import ReviewResume from './pages/ReviewResume'
import NoticeBoard from './pages/NoticeBoard'
import VideoCall from './pages/VideoCall'
import Library from './pages/Library'
import MyBookshelf from './pages/MyBookshelf'
import LibraryAdmin from './pages/LibraryAdmin'
import Classrooms from './pages/Classrooms'
import ClassroomDetail from './pages/ClassroomDetail'
import DynamicPage from './pages/DynamicPage'
import StudyLounge from './pages/StudyLounge'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'

import { Toaster } from 'react-hot-toast'

const App = () => {

  const {getToken} = useAuth()

  useEffect(() => {
    getToken().then((token) => console.log(token));
  }, [])

  return (
    <div>
      <Toaster />
      <Routes>
        <Route path='/' element={ <Home />} />
        <Route path='/onboarding' element={ <Onboarding />} />
        <Route path='/page/:slug' element={ <DynamicPage />} />
        <Route path='/ai' element={ <Layout />}>
            <Route index element={ <Dashboard />} />
            <Route path='generate-question-paper' element={ <GenerateQuestionPaper />} />
            <Route path='review-resume' element={ <ReviewResume />} />
            <Route path='video-call' element={ <VideoCall />} />
            <Route path='library' element={ <Library />} />
            <Route path='library/my-books' element={ <MyBookshelf />} />
            <Route path='library/admin' element={ <LibraryAdmin />} />
            <Route path='community' element={ <NoticeBoard />} />
            <Route path='classrooms' element={ <Classrooms />} />
            <Route path='classrooms/:id' element={ <ClassroomDetail />} />
            <Route path='study-lounge' element={ <StudyLounge />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App
