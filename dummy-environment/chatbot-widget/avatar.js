/**
 * UNILUS Avatar – Uses real PNG graduation cap
 * Eyes follow mouse / finger + light 3D tilt
 */
const UniAvatar = (function () {
  let wrapper = null;
  let body = null;
  let eyes = null;
  let outfitImg = null;
  let outfitChestImg = null;
  let accessoryTopImg = null;
  let accessoryBottomImg = null;
  let glassesImg = null;
  let gavelImg = null;
  let gavelTimer = null;
  let currentState = "idle";
  let currentOutfit = "default";
  let currentGlasses = null;
  let tracking = true;

  const MAX_EYE_MOVE = 11;
  const MAX_TILT = 26;
  const GAVEL_OUTFIT = "law-wig";
  const GAVEL_REST_SRC = "chatbot-widget/gavel-rest.png";
  const GAVEL_SLAM_SRC = "chatbot-widget/gavel.gif";
  const GAVEL_DURATION_MS = 1300;

  // Each entry maps a programme outfit to its layer(s).
  // wrap            -> clothing clipped to the lower body (auto-curved by the circle)
  // chest           -> small item on the chest, also clipped (UNILUS patch, stethoscope)
  // accessoryTop    -> head-area item, not clipped (currently just the wig)
  // accessoryBottom -> item in front of/below the body, not clipped (laptop)
  // raiseCap        -> nudges the floating cap up so it clears a wig
  const OUTFITS = {
    "health-scrub":   { wrap: "chatbot-widget/outfits/health-scrub.png" },
    "health-coat":    { wrap: "chatbot-widget/outfits/health-coat.png" },
    "business":       { wrap: "chatbot-widget/outfits/business-blazer.png" },
    "tech-hoodie":    { wrap: "chatbot-widget/outfits/tech-hoodie.png", accessoryBottom: "chatbot-widget/outfits/laptop.png" },
    "tech-circuit":   { wrap: "chatbot-widget/outfits/tech-circuit-hoodie.png", accessoryBottom: "chatbot-widget/outfits/laptop.png" },
    "law-wig":        { accessoryTop: "chatbot-widget/outfits/law-wig.png", raiseCap: true },
    "spirit-tee":     { wrap: "chatbot-widget/outfits/spirit-tee.png" },
    "spirit-hoodie":  { wrap: "chatbot-widget/outfits/spirit-hoodie.png" }
  };

  // Glasses are a separate, independent layer from outfits - any pair can
  // be worn with any outfit (including the wig) at the same time. Each
  // pair's own width/vertical-offset (tuned from its lens-hole centers so
  // it sits generously over the eyes) lives in CSS under .glasses-<name>.
  const GLASSES = {
    "round-gold":   "chatbot-widget/outfits/glasses-round-gold.png",
    "square-black": "chatbot-widget/outfits/glasses-square-black.png",
    "cateye-black": "chatbot-widget/outfits/glasses-cateye-black.png"
  };

  function init(target, options = {}) {
    const container =
      typeof target === "string" ? document.querySelector(target) : target;

    if (!container) {
      console.error("UniAvatar: container not found");
      return;
    }

    wrapper = document.createElement("div");
    wrapper.className = "uni-avatar-wrapper idle";
    wrapper.id = "uni-avatar";
    wrapper.innerHTML = `
      <img class="uni-cap-img" src="chatbot-widget/cap.png" alt="UNILUS Graduation Cap" />
      <div class="uni-accessory-top-wrap">
        <img class="uni-accessory-top" alt="" />
      </div>
      <div class="uni-glasses-wrap">
        <img class="uni-glasses" alt="" />
      </div>
      <div class="uni-body">
        <img class="uni-outfit-img" alt="" />
        <img class="uni-outfit-chest" alt="" />
        <div class="uni-eyes">
          <div class="uni-eye"></div>
          <div class="uni-eye"></div>
        </div>
      </div>
      <img class="uni-accessory-bottom" alt="" />
      <img class="uni-thinking-bubble" src="chatbot-widget/thinking.gif" alt="Thinking" />
      <img class="uni-gavel-gif" alt="" />
    `;

    if (options.size && options.size !== 1) {
      wrapper.style.transform = `scale(${options.size})`;
      wrapper.style.transformOrigin = "bottom center";
    }

    container.appendChild(wrapper);

    body = wrapper.querySelector(".uni-body");
    eyes = wrapper.querySelector(".uni-eyes");
    outfitImg = wrapper.querySelector(".uni-outfit-img");
    outfitChestImg = wrapper.querySelector(".uni-outfit-chest");
    accessoryTopImg = wrapper.querySelector(".uni-accessory-top");
    accessoryBottomImg = wrapper.querySelector(".uni-accessory-bottom");
    glassesImg = wrapper.querySelector(".uni-glasses");
    gavelImg = wrapper.querySelector(".uni-gavel-gif");

    setState(options.state || "idle");
    setOutfit(options.outfit || "default");
    setGlasses(options.glasses || null);
    startTracking();
    startGavelClicks();

    return wrapper;
  }

  // Tapping/clicking the avatar itself (the ball or the cap - which only
  // have pointer-events:auto in avatar.css while the lawyer outfit is on)
  // plays the gavel slam once.
  function startGavelClicks() {
    if (!wrapper) return;
    wrapper.addEventListener("click", (e) => {
      if (currentOutfit === GAVEL_OUTFIT && e.target.closest(".uni-body, .uni-cap-img")) {
        slamGavel();
      }
    });
  }

  function slamGavel() {
    if (!wrapper || !gavelImg || currentOutfit !== GAVEL_OUTFIT) return;

    // Re-triggering the src (cache-busted) restarts the gif's own slam
    // animation from frame 0, even if a slam is already mid-play.
    gavelImg.src = `${GAVEL_SLAM_SRC}?t=${Date.now()}`;
    wrapper.classList.add("gavel-active");

    if (gavelTimer) clearTimeout(gavelTimer);
    gavelTimer = setTimeout(() => {
      wrapper.classList.remove("gavel-active");
      // Settle back on the resting pose rather than disappearing.
      if (gavelImg && currentOutfit === GAVEL_OUTFIT) {
        gavelImg.src = GAVEL_REST_SRC;
      }
      gavelTimer = null;
    }, GAVEL_DURATION_MS);
  }

  function startTracking() {
    window.addEventListener("mousemove", handlePointer, { passive: true });
    window.addEventListener("touchmove", (e) => {
      if (e.touches.length > 0) {
        handlePointer({
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY
        });
      }
    }, { passive: true });
    window.addEventListener("touchstart", (e) => {
      if (e.touches.length > 0) {
        handlePointer({
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY
        });
      }
    }, { passive: true });
  }

  function handlePointer(e) {
    if (!tracking || !wrapper || !body || !eyes) return;
    if (currentState === "happy" || currentState === "worry") return;

    const rect = body.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = (e.clientX - centerX) / (window.innerWidth / 2);
    let dy = (e.clientY - centerY) / (window.innerHeight / 2);

    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));

    const eyeX = dx * MAX_EYE_MOVE;
    const eyeY = dy * MAX_EYE_MOVE * 0.7;
    eyes.style.transform = `translate(${eyeX}px, ${eyeY}px)`;

    const tiltY = dx * MAX_TILT;
    const tiltX = -dy * MAX_TILT;
    body.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

    // Keep the wig tilting with the head (it just sits above the eyes).
    // (Positioning/centering now lives on the parent .uni-accessory-top-wrap,
    // so this transform only needs the tracking offset itself.)
    if (accessoryTopImg && wrapper.classList.contains("has-accessory-top")) {
      accessoryTopImg.style.transform =
        `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    }

    // Glasses are worn ON the eyes, so - independent of whatever outfit is
    // on - they always follow the eye offset as well as the head tilt.
    if (glassesImg && wrapper.classList.contains("has-glasses")) {
      glassesImg.style.transform =
        `translate(${eyeX}px, ${eyeY}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    }
  }

  function setState(state) {
    if (!wrapper) return;

    wrapper.classList.remove(
      "idle", "happy", "worry",
      "look-left", "look-right", "look-up", "thinking"
    );
    wrapper.classList.add(state);
    currentState = state;

    if (state === "happy" || state === "worry" || state === "idle") {
      if (body) body.style.transform = "";
      if (eyes) eyes.style.transform = "";
      if (accessoryTopImg) accessoryTopImg.style.transform = "";
      if (glassesImg) glassesImg.style.transform = "";
    }
  }

  function setOutfit(name) {
    if (!wrapper) return;

    wrapper.classList.remove(
      "has-outfit", "has-outfit-chest",
      "has-accessory-top", "has-accessory-bottom", "raise-cap"
    );
    Array.from(wrapper.classList)
      .filter((c) => c.startsWith("outfit-"))
      .forEach((c) => wrapper.classList.remove(c));

    if (outfitImg) { outfitImg.removeAttribute("src"); }
    if (outfitChestImg) { outfitChestImg.removeAttribute("src"); }
    if (accessoryTopImg) { accessoryTopImg.removeAttribute("src"); accessoryTopImg.style.transform = ""; }
    if (accessoryBottomImg) { accessoryBottomImg.removeAttribute("src"); }

    // Gavel only exists for the lawyer outfit - reset it on every switch so
    // it doesn't keep animating/showing once the outfit changes away.
    if (gavelTimer) { clearTimeout(gavelTimer); gavelTimer = null; }
    wrapper.classList.remove("gavel-active");
    if (gavelImg) { gavelImg.removeAttribute("src"); }

    if (!name || name === "default") {
      currentOutfit = "default";
      return;
    }

    const config = OUTFITS[name];
    if (!config) {
      console.warn(`UniAvatar: unknown outfit "${name}"`);
      currentOutfit = "default";
      return;
    }

    wrapper.classList.add(`outfit-${name}`);

    if (config.wrap && outfitImg) {
      outfitImg.src = config.wrap;
      wrapper.classList.add("has-outfit");
    }
    if (config.chest && outfitChestImg) {
      outfitChestImg.src = config.chest;
      wrapper.classList.add("has-outfit-chest");
    }
    if (config.accessoryTop && accessoryTopImg) {
      accessoryTopImg.src = config.accessoryTop;
      wrapper.classList.add("has-accessory-top");
    }
    if (config.accessoryBottom && accessoryBottomImg) {
      accessoryBottomImg.src = config.accessoryBottom;
      wrapper.classList.add("has-accessory-bottom");
    }
    if (config.raiseCap) {
      wrapper.classList.add("raise-cap");
    }
    if (name === GAVEL_OUTFIT && gavelImg) {
      gavelImg.src = GAVEL_REST_SRC;
    }

    currentOutfit = name;
  }

  function getOutfit() { return currentOutfit; }

  // Independent of setOutfit() - any glasses can be worn with any outfit
  // (including no outfit, or the wig) since they live on their own layer.
  function setGlasses(name) {
    if (!wrapper) return;

    Array.from(wrapper.classList)
      .filter((c) => c.startsWith("glasses-"))
      .forEach((c) => wrapper.classList.remove(c));
    wrapper.classList.remove("has-glasses");

    if (glassesImg) { glassesImg.removeAttribute("src"); glassesImg.style.transform = ""; }

    if (!name || name === "none") {
      currentGlasses = null;
      return;
    }

    const src = GLASSES[name];
    if (!src) {
      console.warn(`UniAvatar: unknown glasses "${name}"`);
      currentGlasses = null;
      return;
    }

    wrapper.classList.add(`glasses-${name}`, "has-glasses");
    if (glassesImg) { glassesImg.src = src; }
    currentGlasses = name;
  }

  function getGlasses() { return currentGlasses; }

  function happy()     { setState("happy"); }
  function worry()     { setState("worry"); }
  function idle()      { setState("idle"); }
  function lookLeft()  { setState("look-left"); }
  function lookRight() { setState("look-right"); }
  function lookUp()    { setState("look-up"); }
  function thinking()  { setState("thinking"); }

  function getState()  { return currentState; }
  function enableTracking()  { tracking = true; }
  function disableTracking() { tracking = false; }

  function destroy() {
    if (gavelTimer) { clearTimeout(gavelTimer); gavelTimer = null; }
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
      wrapper = null;
      body = null;
      eyes = null;
    }
  }

  return {
    init, setState, happy, worry, idle,
    lookLeft, lookRight, lookUp, thinking,
    getState, enableTracking, disableTracking, destroy,
    setOutfit, getOutfit, setGlasses, getGlasses
  };
})();

window.UniAvatar = UniAvatar;