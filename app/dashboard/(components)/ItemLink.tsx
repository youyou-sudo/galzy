"use client";
import React from "react";

import { usePathname } from "next/navigation";
import { Button, Link } from "@nextui-org/react";
import { Card } from "@/components/ui/card";
import { TbLayoutDashboardFilled } from "react-icons/tb";
import { SiMeilisearch } from "react-icons/si";

export default function ItemLink({ pathdata }: any) {
  const routerpath = usePathname();
  const icons = {
    Dashboard: <TbLayoutDashboardFilled />,
    meilisearch: <SiMeilisearch />,
  };

  return (
    <div>
      <Card className="flex flex-col">
        {pathdata.dashboard.map((item) => (
          <Button
            as={Link}
            href={item.path}
            startContent={icons[item.title]}
            className={`rounded`}
            key={item.path}
            variant={routerpath === item.path ? "flat" : "light"}
          >
            {item.title}
          </Button>
        ))}
      </Card>
    </div>
  );
}
