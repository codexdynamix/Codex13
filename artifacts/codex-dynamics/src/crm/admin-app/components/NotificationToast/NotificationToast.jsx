import React, { useState, useImperativeHandle, forwardRef } from 'react';

const NotificationToast = forwardRef((props, ref) => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('success'); // success, error, info
  const [isVisible, setIsVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    show(msg, notificationType = 'success') {
      setMessage(msg);
      setType(notificationType);
      setIsVisible(true);
      setTimeout(() => {
        setIsVisible(false);
      }, 2500); // Hide after 2.5 seconds
    }
  }));

  if (!isVisible) return null;

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className={`crm-notification-toast ${bgColor}`}>
      {message}
    </div>
  );
});

export default NotificationToast;
