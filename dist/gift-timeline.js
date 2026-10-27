export const GIFT_DURATION=16;
// Shell travel takes 0.32s; its large bloom follows 0.11s later.
export const GIFT_LAUNCHES=[5.68,7.68,9.68];
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function giftFrame(seconds){
  const s=Math.max(0,Number(seconds)||0);
  const phase=s<2?'arrival':s<6?'build':s<12?'bloom':'thanks';
  const copy={arrival:'这一秒，雨为你停住',build:'把笑意，变成光',bloom:'笑开了，整片花园',thanks:'谢谢你，让这里发光'};
  return {phase,mode:s<5.68?'rain':s<11.2?'bloom':'still',hand:s>=.72&&s<1.95,
    finger:(s>=.04&&s<.65)||(s>=8.35&&s<8.98),opacity:1-smooth((s-13)/3),copy:copy[phase],done:s>=GIFT_DURATION};
}
