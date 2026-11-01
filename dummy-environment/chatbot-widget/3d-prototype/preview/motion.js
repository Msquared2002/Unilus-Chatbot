export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const damp = (current, target, rate, dt) => current + (target-current)*(1-Math.exp(-rate*dt));
export function pose(time, state, reduced=false) {
  const amount = reduced ? .2 : 1;
  return {
    float: Math.sin(time*2)*.045*amount + (state==='happy' ? Math.abs(Math.sin(time*6))*.11*amount : 0),
    roll: state==='thinking' ? Math.sin(time*1.7)*.025*amount : 0,
    gazeX: state==='thinking' ? -.035 : 0,
    gazeY: state==='thinking' ? .035 : 0,
    eyeScale: state==='happy' ? 1.08 : 1
  };
}
export function blinkScale(age) {
  if(age<0 || age>.22) return 1;
  return Math.max(.06,1-Math.sin(Math.PI*age/.22));
}
