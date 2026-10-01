export default function Home() {
  return (
    <>
      <section className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-2xl">Hi, I&rsquo;m Liam</p>
        <h1 className="text-5xl font-bold uppercase">Product Designer</h1>
      </section>
      <section id="projects" className="min-h-dvh px-16 py-24">
        <h2 className="text-5xl font-bold uppercase">Projects</h2>
      </section>
      <section id="about" className="min-h-dvh px-16 py-24">
        <h2 className="text-5xl font-bold uppercase">About me</h2>
      </section>
      <section id="contact" className="min-h-dvh px-16 pb-32 pt-24 text-center">
        <p>If you made it here,</p>
        <h2 className="font-accent text-5xl italic text-rose">let&rsquo;s just talk?</h2>
      </section>
    </>
  );
}
