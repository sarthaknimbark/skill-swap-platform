import React, { useEffect, useState } from 'react'
import axios from 'axios';
const ProtectedRoute = ({children}) => {
  const [isAuth , setIsAuth] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await axios.get('/api/auth/check', { withCredentials: true });
        setIsAuth(true);
      } catch (err) {
        console.log(err); 
        setIsAuth(false);
      };
    }
    checkAuth();
  },[]);
  if (isAuth === null) return <div>Loading...</div>; 
  if (!isAuth) return <Navigate to="/login" replace />;
  return children;
}

export default ProtectedRoute;