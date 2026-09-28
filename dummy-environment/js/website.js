(function () {
  const hero = document.querySelector(".site-hero");
  if (!hero) return;
  const slides = [
    {
      image: "assets/hero-lecture.jpg",
      title: "Welcome to University of\nLusaka",
      copy: "Empowering minds, shaping futures and advancing knowledge for a\nbetter tomorrow through excellence in education and research",
    },
    {
      image: "assets/hero-graduation.jpg",
      title: "Learn, lead and\nmake an impact",
      copy: "Empowering minds, shaping futures and advancing knowledge for a\nbetter tomorrow through excellence in education and research",
    },
  ];
  let index = 0;
  function render() {
    const slide = slides[index];
    hero.style.backgroundImage = `url("${slide.image}")`;
    document.querySelector("[data-hero-title]").textContent = slide.title;
    document.querySelector("[data-hero-copy]").textContent = slide.copy;
  }
  document.querySelector("[data-hero-next]")?.addEventListener("click", () => {
    index = (index + 1) % slides.length;
    render();
  });
  document.querySelector("[data-hero-prev]")?.addEventListener("click", () => {
    index = (index + slides.length - 1) % slides.length;
    render();
  });
})();
