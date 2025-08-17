import { StrategEdit } from "@/components/dashboard/dataManagement/strategy/strategyEdit";
import StrategyList from "@/components/dashboard/dataManagement/strategy/strategyList";
import React from "react";

export default function page() {
  return (
    <div>
      <StrategyList />
      <StrategEdit />
    </div>
  );
}
