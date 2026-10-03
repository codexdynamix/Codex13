/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from "react";
import { ContactModal } from "@/components/ContactModal";

interface ContactModalContextType {
  isOpen: boolean;
  openContactModal: (service?: string) => void;
  closeContactModal: () => void;
}

const ContactModalContext = createContext<ContactModalContextType | undefined>(undefined);

export function ContactModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string | undefined>(undefined);

  const openContactModal = (service?: string) => {
    if (service) setSelectedService(service);
    setIsOpen(true);
  };

  const closeContactModal = () => {
    setIsOpen(false);
  };

  return (
    <ContactModalContext.Provider
      value={{
        isOpen,
        openContactModal,
        closeContactModal,
      }}
    >
      {children}
      <ContactModal
        isOpen={isOpen}
        onClose={closeContactModal}
        defaultService={selectedService}
      />
    </ContactModalContext.Provider>
  );
}

export function useContactModal() {
  const context = useContext(ContactModalContext);
  if (!context) {
    throw new Error("useContactModal must be used within a ContactModalProvider");
  }
  return context;
}
