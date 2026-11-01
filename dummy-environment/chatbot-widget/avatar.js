/**
 * UNILUS Avatar – Uses real PNG graduation cap
 * Eyes follow mouse / finger + light 3D tilt
 * Changes: Creates avatar layers and manages expression, gaze, outfit, and accessory state.
 * Affects: Widget avatar slots and hairstyle/outfit assets styled by avatar.css.
 * Purpose: Keeps motion and appearance updates behind the UniAvatar public controls.
 */
const UniAvatar = (function () {
  let wrapper = null;
  let motion = null;
  let body = null;
  let eyes = null;
  let outfitImg = null;
  let outfitChestImg = null;
  let accessoryTopImg = null;
  let accessoryBottomImg = null;
  let glassesImg = null;
  let hairWrap = null;
  let hairImg = null;
  let gavelImg = null;
  let gavelTimer = null;
  let currentState = "idle";
  let currentOutfit = "default";
  let currentGlasses = null;
  let currentLaptop = false;
  let currentHairstyle = null;
  let tracking = true;
  let gaze = { x: 0, y: 0 };
  let blinkTimer = null;

  const MAX_EYE_MOVE = 11;
  // Barely perceptible head response; eye tracking carries the expression.
  const MAX_TILT = 2;
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
    "tech-hoodie":    { wrap: "chatbot-widget/outfits/tech-hoodie.png" },
    "tech-circuit":   { wrap: "chatbot-widget/outfits/tech-circuit-hoodie.png" },
    "law-wig":        { accessoryTop: "chatbot-widget/outfits/law-wig.png", raiseCap: true },
    "spirit-tee":     { wrap: "chatbot-widget/outfits/spirit-tee.png" },
    "spirit-hoodie":  { wrap: "chatbot-widget/outfits/spirit-hoodie.png" },
    "green-polo": { wrap: "chatbot-widget/outfits/green-polo.png" },
    "navy-varsity-tee": { wrap: "chatbot-widget/outfits/navy-varsity-tee.png" },
    "white-varsity-tee": { wrap: "chatbot-widget/outfits/white-varsity-tee.png" },
    "gray-spirit-hoodie": { wrap: "chatbot-widget/outfits/gray-spirit-hoodie.png" },
    "black-spirit-hoodie": { wrap: "chatbot-widget/outfits/black-spirit-hoodie.png" },
    "maroon-spirit-hoodie": { wrap: "chatbot-widget/outfits/maroon-spirit-hoodie.png" },
    "white-nursing-uniform": { wrap: "chatbot-widget/outfits/white-nursing-uniform.png" },
    "striped-nursing-uniform": { wrap: "chatbot-widget/outfits/striped-nursing-uniform.png" }
  };

  // Glasses are a separate, independent layer from outfits - any pair can
  // be worn with any outfit (including the wig) at the same time. Each
  // pair's proportional width and lens-centred offsets ensure
  // fixed frames fit the eye region; only gaze moves inside the lenses.
  const GLASSES = {
    // Frame sizes and offsets from TEST_MAP_VERSION; eye spacing is unchanged.
    "round-gold":   { src: "chatbot-widget/outfits/glasses-round-gold.png", bottom: 18, width: 91 },
    "square-black": { src: "chatbot-widget/outfits/glasses-square-black.png", bottom: 33, width: 94 },
    "cateye-black": { src: "chatbot-widget/outfits/glasses-cateye-black.png", bottom: 28, width: 95 }
  };

  function init(target, options = {}) {
    const container =
      typeof target === "string" ? document.querySelector(target) : target;

    if (!container) {
      console.error("UniAvatar: container not found");
      return;
    }

    destroy(); // A second init must not leave tracking listeners behind.
    tracking = true;

    wrapper = document.createElement("div");
    wrapper.className = "uni-avatar-wrapper idle";
    wrapper.id = "uni-avatar";
    wrapper.innerHTML = `
      <img class="uni-cap-img" src="chatbot-widget/cap.png" alt="UNILUS Graduation Cap" />
      <div class="uni-float"><div class="uni-motion"><div class="uni-expression">
      <div class="uni-hair-wrap">
        <img class="uni-hair" alt="" />
      </div>
      <div class="uni-accessory-top-wrap">
        <img class="uni-accessory-top" alt="" />
      </div>
      <div class="uni-glasses-wrap">
        <img class="uni-glasses" alt="" />
      </div>
      <div class="uni-body">
        <img class="uni-outfit-img" alt="" />
        <img class="uni-outfit-chest" alt="" />
        <div class="uni-gaze"><div class="uni-eyes">
          <div class="uni-eye"><div class="uni-eye-white"></div></div>
          <div class="uni-eye"><div class="uni-eye-white"></div></div>
        </div></div>
      </div>
      <img class="uni-gavel-gif" alt="" />
      </div></div>
      <img class="uni-accessory-bottom" alt="" />
      </div>
      <img class="uni-thinking-bubble" src="chatbot-widget/thinking.gif" alt="Thinking" />
    `;

    if (options.size && options.size !== 1) {
      wrapper.style.transform = `scale(${options.size})`;
      wrapper.style.transformOrigin = "bottom center";
    }

    container.appendChild(wrapper);

    body = wrapper.querySelector(".uni-body");
    motion = wrapper.querySelector(".uni-motion");
    eyes = wrapper.querySelector(".uni-gaze");
    outfitImg = wrapper.querySelector(".uni-outfit-img");
    outfitChestImg = wrapper.querySelector(".uni-outfit-chest");
    accessoryTopImg = wrapper.querySelector(".uni-accessory-top");
    accessoryBottomImg = wrapper.querySelector(".uni-accessory-bottom");
    glassesImg = wrapper.querySelector(".uni-glasses");
    hairWrap = wrapper.querySelector(".uni-hair-wrap");
    hairImg = wrapper.querySelector(".uni-hair");
    gavelImg = wrapper.querySelector(".uni-gavel-gif");

    setState(options.state || "idle");
    setOutfit(options.outfit || "default");
    setGlasses(options.glasses || null);
    setLaptop(Boolean(options.laptop));
    setHairstyle(options.hairstyle || null);
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
    window.addEventListener("touchmove", handleTouch, { passive: true });
    window.addEventListener("touchstart", handleTouch, { passive: true });
    window.addEventListener("blur", resetTracking);
    document.addEventListener("mouseleave", resetTracking);
  }

  function handleTouch(e) {
    if (e.touches.length) handlePointer(e.touches[0]);
  }

  function resetTracking() {
    gaze = { x: 0, y: 0 };
    if (motion) motion.style.transform = "";
    if (eyes) eyes.style.transform = "";
    if (glassesImg) glassesImg.style.transform = "";
  }

  function applyGaze(x = gaze.x, y = gaze.y) {
    if (!eyes) return;
    gaze = { x, y };
    const eyeX = x * MAX_EYE_MOVE;
    const eyeY = y * 7.7;
    eyes.style.transform = `translate(${eyeX}px, ${eyeY}px)`;
    // TEST_MAP_VERSION: the whole eye/glasses region follows gaze together.
    if (glassesImg) glassesImg.style.transform = currentGlasses
      ? `translate(${eyeX}px, ${eyeY}px)` : "";
  }

  function handlePointer(e) {
    if (!tracking || !wrapper || !motion || !eyes) return;

    // The stationary positioning box avoids feedback from the moving artwork.
    const rect = wrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height * (100 / 145);

    let dx = (e.clientX - centerX) / (window.innerWidth / 2);
    let dy = (e.clientY - centerY) / (window.innerHeight / 2);

    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));

    applyGaze(dx, dy);

    const tiltY = dx * MAX_TILT;
    const tiltX = -dy * MAX_TILT;
    motion.style.transform = `translate(${dx * .4}px, ${dy * .3}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  }

  function setState(state) {
    if (!wrapper) return;

    wrapper.classList.remove(
      "idle", "happy", "worry", "sad", "surprised",
      "look-left", "look-right", "look-up", "thinking"
    );
    wrapper.classList.add(state);
    currentState = state;

    // Explicit gaze commands start from neutral. Emotion changes compose with
    // the current cursor pose instead of snapping the assembled character back.
    if (["look-left", "look-right", "look-up"].includes(state)) {
      resetTracking();
      applyGaze(state === "look-left" ? -1 : state === "look-right" ? 1 : 0, state === "look-up" ? -1 : 0);
    } else {
      applyGaze();
    }
  }

  function setOutfit(name) {
    if (!wrapper) return;

    wrapper.classList.remove(
      "has-outfit", "has-outfit-chest",
      "has-accessory-top", "raise-cap"
    );
    Array.from(wrapper.classList)
      .filter((c) => c.startsWith("outfit-"))
      .forEach((c) => wrapper.classList.remove(c));

    if (outfitImg) { outfitImg.removeAttribute("src"); }
    if (outfitChestImg) { outfitChestImg.removeAttribute("src"); }
    if (accessoryTopImg) { accessoryTopImg.removeAttribute("src"); accessoryTopImg.style.transform = ""; }

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
    if (config.raiseCap) {
      wrapper.classList.add("raise-cap");
    }
    if (name === GAVEL_OUTFIT && gavelImg) {
      gavelImg.src = GAVEL_REST_SRC;
    }

    currentOutfit = name;
  }

  function getOutfit() { return currentOutfit; }

  // Laptop is its own layer and survives outfit changes.
  function setLaptop(enabled) {
    if (!wrapper || !accessoryBottomImg) return;
    currentLaptop = Boolean(enabled);
    wrapper.classList.toggle("has-accessory-bottom", currentLaptop);
    if (currentLaptop) accessoryBottomImg.src = "chatbot-widget/outfits/laptop.png";
    else accessoryBottomImg.removeAttribute("src");
  }

  function getLaptop() { return currentLaptop; }

  function setHairstyle(id) {
    if (!wrapper || !hairImg || !hairWrap) return;
    const style = UnilusHairstyles.get(id);
    currentHairstyle = style?.id || null;
    wrapper.classList.toggle("has-hair", Boolean(style));
    wrapper.dataset.hairstyle = currentHairstyle || "none";
    wrapper.style.setProperty("--uni-hair-cap-top", `${style?.capTop ?? -14}px`);
    hairImg.style.transform = "";
    if (!style) {
      hairImg.removeAttribute("src");
      return;
    }
    hairImg.src = style.src;
    hairWrap.style.width = `${style.width}px`;
    hairWrap.style.top = `${style.top}px`;
    hairWrap.style.marginLeft = `${style.offset}px`;
    // A reversible face opening removes only inward overlap. The circle is
    // anchored to the unchanged sphere, expressed in this asset's own canvas.
    hairWrap.style.setProperty("--hair-opening-x", `${style.width / 2 - style.offset}px`);
    hairWrap.style.setProperty("--hair-opening-y", `${100 - style.top}px`);
    hairWrap.style.setProperty("--hair-opening-rx", `${style.opening.rx}px`);
    hairWrap.style.setProperty("--hair-opening-ry", `${style.opening.ry}px`);
  }

  function getHairstyle() { return currentHairstyle; }

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
      wrapper.style.setProperty("--uni-eye-gap", "14px");
      applyGaze();
      return;
    }

    const fit = GLASSES[name];
    if (!fit) {
      console.warn(`UniAvatar: unknown glasses "${name}"`);
      currentGlasses = null;
      wrapper.style.setProperty("--uni-eye-gap", "14px");
      applyGaze();
      return;
    }

    wrapper.classList.add(`glasses-${name}`, "has-glasses");
    if (glassesImg) { glassesImg.src = fit.src; }
    currentGlasses = name;
    wrapper.style.setProperty("--uni-eye-gap", "14px");
    wrapper.style.setProperty("--uni-glasses-width", `${fit.width}px`);
    wrapper.style.setProperty("--uni-glasses-bottom", `${fit.bottom}px`);
    applyGaze();
  }

  function getGlasses() { return currentGlasses; }

  function blink() {
    if (!wrapper) return;
    wrapper.classList.add("is-blinking");
    if (blinkTimer) clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      wrapper?.classList.remove("is-blinking");
      blinkTimer = null;
    }, 240);
  }

  function happy()     { setState("happy"); }
  function worry()     { setState("worry"); }
  function sad()       { setState("sad"); }
  function surprised() { setState("surprised"); }
  function idle()      { setState("idle"); }
  function lookLeft()  { setState("look-left"); }
  function lookRight() { setState("look-right"); }
  function lookUp()    { setState("look-up"); }
  function thinking()  { setState("thinking"); }

  function getState()  { return currentState; }
  function enableTracking()  { tracking = true; }
  function disableTracking() { tracking = false; resetTracking(); }

  function destroy() {
    window.removeEventListener("mousemove", handlePointer);
    window.removeEventListener("touchmove", handleTouch);
    window.removeEventListener("touchstart", handleTouch);
    window.removeEventListener("blur", resetTracking);
    document.removeEventListener("mouseleave", resetTracking);
    if (gavelTimer) { clearTimeout(gavelTimer); gavelTimer = null; }
    if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = null; }
    resetTracking();
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
    wrapper = body = motion = eyes = hairWrap = hairImg = null;
    outfitImg = outfitChestImg = accessoryTopImg = accessoryBottomImg = glassesImg = gavelImg = null;
    currentHairstyle = null;
  }

  return {
    init, setState, happy, worry, sad, surprised, idle,
    lookLeft, lookRight, lookUp, thinking,
    getState, enableTracking, disableTracking, destroy,
    setOutfit, getOutfit, setGlasses, getGlasses, setLaptop, getLaptop,
    setHairstyle, getHairstyle, resetTracking, blink
  };
})();

window.UniAvatar = UniAvatar;
