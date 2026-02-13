import { Navigate } from "react-router";
import { useAuth } from "../context/AuthContext"; 

const ProtectedRoute = ({ children }) => { 


  const { user, loading } = useAuth();
  if (loading) {
    return <div>Loading...</div>; // or splash screen / spinner
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
