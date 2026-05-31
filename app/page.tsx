import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FeaturedGames from './components/FeaturedGames'
import Changelog from './components/Changelog'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import Faq from './components/Faq'

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      <Hero />
      <FeaturedGames />
      <Changelog />
      <Faq />
      <Footer />
      <ScrollToTop />
    </main>
  )
}
