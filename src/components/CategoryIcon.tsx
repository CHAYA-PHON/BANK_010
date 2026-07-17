import { 
  Utensils, 
  ShoppingBag, 
  Car, 
  Droplet, 
  Tv, 
  HeartPulse, 
  Home, 
  Coins, 
  Grid,
  TrendingUp,
  TrendingDown
} from "lucide-react";

interface CategoryIconProps {
  name: string;
  className?: string;
}

export default function CategoryIcon({ name, className = "w-5 h-5" }: CategoryIconProps) {
  switch (name) {
    case "Utensils":
      return <Utensils className={className} />;
    case "ShoppingBag":
      return <ShoppingBag className={className} />;
    case "Car":
      return <Car className={className} />;
    case "Droplet":
      return <Droplet className={className} />;
    case "Tv":
      return <Tv className={className} />;
    case "HeartPulse":
      return <HeartPulse className={className} />;
    case "Home":
      return <Home className={className} />;
    case "Coins":
      return <Coins className={className} />;
    case "TrendingUp":
      return <TrendingUp className={className} />;
    case "TrendingDown":
      return <TrendingDown className={className} />;
    default:
      return <Grid className={className} />;
  }
}
