import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Dev page: ?gallery renders the 3D part library instead of the app.
const Gallery = lazy(() => import('./three/Gallery.tsx'))
const showGallery = location.search.includes('gallery')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showGallery ? (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
