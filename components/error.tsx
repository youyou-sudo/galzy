"use client";

import { Image } from "@nextui-org/react";

export default function Errors({ code }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-center">
        <Image
          alt={`"Request error, error code ${code}"`}
          src={`https://http.toshiki.dev/${code}.png`}
        />
      </div>
      <h1 className="text-center font-size-4xl text-3xl">Error {code}</h1>
    </div>
  );
}
