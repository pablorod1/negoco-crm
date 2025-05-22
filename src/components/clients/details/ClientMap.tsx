"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ClientMapProps {
  className?: string;
  coordinates?: [number, number];
  zoom?: number;
  markerIconUrl?: string;
}

const ClientMap = ({
  className,
  coordinates,
  zoom = 16,
  markerIconUrl = "/icons/map-pin.gif",
}: ClientMapProps) => {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!coordinates) return;
    if (typeof window === "undefined") return;
    // Initialize map only if it doesn't exist
    if (!mapRef.current) {
      mapRef.current = L.map("map", {
        zoomControl: false,
      }).setView(coordinates, zoom);

      // Add tile layer
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }
      ).addTo(mapRef.current);
    } else {
      // If map exists, just update the view
      mapRef.current.setView(coordinates, zoom);
    }

    // Create marker icon
    const markerIcon = L.icon({
      iconUrl: markerIconUrl,
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    // Add marker
    const marker = L.marker(coordinates, {
      icon: markerIcon,
    }).addTo(mapRef.current);

    // Cleanup function
    return () => {
      if (mapRef.current) {
        marker.remove();
      }
    };
  }, [coordinates, zoom, markerIconUrl]);

  // Complete cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div id="map" className={className}></div>;
};

export default ClientMap;
