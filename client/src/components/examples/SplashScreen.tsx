import { SplashScreen } from "../SplashScreen";

export default function SplashScreenExample() {
  return (
    <SplashScreen 
      onNewGame={() => console.log("New game")} 
      onLoadGame={() => console.log("Load game")} 
    />
  );
}
