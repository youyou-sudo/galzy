"use server";
import { editupdata, deleteEntryById, datadbup } from "@/lib/vndbdata";
import { distinguishAndUpdate } from "@/lib/task/databaseSynchronization";
import { stringify, parse } from "flatted";

export const updatas = async (formData) => {
  const { id, name, jsonorl, timeVersion, type } = Object.fromEntries(formData);
  const reff = await editupdata({ id, name, jsonorl, timeVersion, type });
  return reff;
};

export const vndbmgetac = async (ref) => {
  const { id, name, jsonorl, timeVersion, type } = ref;
  const log = await distinguishAndUpdate({
    id,
    name,
    jsonorl,
    timeVersion,
    type,
  });
  return log;
};

export const deleteProjectEntry = async (id) => {
  const log = await deleteEntryById(id);
  return log;
};
export const uujuuxxb = async () => {
  const row = await datadbup();
  return parse(stringify(row));
};
