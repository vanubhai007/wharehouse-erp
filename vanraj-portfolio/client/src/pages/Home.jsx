import Hero from '../components/sections/Hero/Hero.jsx';
import About from '../components/sections/About/About.jsx';
import Skills from '../components/sections/Skills/Skills.jsx';
import Projects from '../components/sections/Projects/Projects.jsx';
import Experience from '../components/sections/Experience/Experience.jsx';
import Services from '../components/sections/Services/Services.jsx';
import Contact from '../components/sections/Contact/Contact.jsx';

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <Skills />
      <Projects />
      <Experience />
      <Services />
      <Contact />
    </>
  );
}
