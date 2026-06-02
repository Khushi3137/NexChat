import React from 'react';
import { Toaster } from 'react-hot-toast';

const Toast = () => (
  <Toaster
    position="top-right"
    toastOptions={{
      style: {
        background: '#1e2233',
        color: '#fff',
        border: '1px solid #333',
      },
      success: { iconTheme: { primary: '#6c63ff', secondary: '#fff' } },
    }}
  />
);

export default Toast;
