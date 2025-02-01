"use client";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
  Form,
  Input,
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { useEffect, useState } from "react";
import {
  deleteEntry,
  entryAc,
  getAllEntry,
} from "../../(action)/dataunion/addentry";
import { useToast } from "@/components/hooks/use-toast";
import { FiEdit3, FiMoreVertical } from "react-icons/fi";
import { MdDeleteOutline } from "react-icons/md";

export default function ListTap() {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();
  const { toast } = useToast();
  const [formdata, setFormdata] = useState({
    id: "",
    vnid: "",
    bangumi_id: "",
    ymgal_id: "",
    credible: 0,
  });
  interface Entry {
    id: number;
    vnid: string;
    bangumi_id: string | null;
    ymgal_id: string | null;
    credible: number;
  }

  const [pagedata, setPagedata] = useState<{
    data: Entry[];
    totalEntries: number;
    totalPages: number;
  }>({
    data: [],
    totalEntries: 0,
    totalPages: 0,
  });

  // 提交 OR 更新数据并刷新列表
  const formAction = async (formdata: FormData) => {
    const log = await entryAc(formdata);
    if (log.status === "success") {
      onClose();
      setFormdata({
        id: "",
        vnid: "",
        bangumi_id: "",
        ymgal_id: "",
        credible: 0,
      });
      setPagedata(await getAllEntry(1, 10));
    }
    toast({
      title: log.message,
    });
  };

  useEffect(() => {
    // fetch data
    (async () => {
      const log = await getAllEntry(1, 10);
      setPagedata(log);
    })();
  }, []);

  return (
    <>
      <div className="flex mb-4">
        <Button
          onPress={() => {
            setFormdata({
              id: "",
              vnid: "",
              bangumi_id: "",
              ymgal_id: "",
              credible: 0,
            });
            onOpen();
          }}
          size="sm"
          variant="solid"
          color="primary"
          className="ml-auto"
        >
          Add entry
        </Button>
      </div>
      <Table aria-label="Example static collection table">
        <TableHeader>
          <TableColumn>VNID</TableColumn>
          <TableColumn>Bangumi</TableColumn>
          <TableColumn>Ymgal</TableColumn>
          <TableColumn>可信度</TableColumn>
          <TableColumn className="text-end">Actions</TableColumn>
        </TableHeader>
        <TableBody>
          {pagedata.data.map((item: any) => (
            <TableRow key={item.id}>
              <TableCell>{item.vnid}</TableCell>
              <TableCell>{item.bangumi_id}</TableCell>
              <TableCell>{item.ymgal_id}</TableCell>
              <TableCell>
                {item.credible === 0
                  ? "✍人工"
                  : item.credible === 1
                    ? "🤖机器"
                    : "❔未知"}
              </TableCell>
              <TableCell className="flex gap-2 justify-end items-center">
                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly variant="light">
                      <FiMoreVertical />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Static Actions"
                    className="flex ml-auto"
                  >
                    <DropdownItem
                      className="flex items-center gap-2"
                      key="edit"
                      startContent={<FiEdit3 />}
                      onPress={() => {
                        setFormdata({
                          id: item.id,
                          vnid: item.vnid,
                          bangumi_id: item.bangumi_id,
                          ymgal_id: item.ymgal_id,
                          credible: item.credible,
                        });
                        onOpen();
                      }}
                    >
                      编辑
                    </DropdownItem>
                    <DropdownItem
                      key="delete"
                      className="text-danger"
                      startContent={<MdDeleteOutline />}
                      color="danger"
                      onPress={async () => {
                        const logss = await deleteEntry(item.id);
                        toast({
                          title: logss.message,
                        });
                        setPagedata(await getAllEntry(1, 10));
                      }}
                    >
                      删除
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* 表单 */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {formdata.id ? "编辑" : "添加"}数据
              </ModalHeader>
              <ModalBody as={Form} action={formAction}>
                <Input
                  name="id"
                  label="ID"
                  className="hidden"
                  defaultValue={formdata.id}
                ></Input>
                <Input
                  name="vnid"
                  label="VNDB ID"
                  defaultValue={formdata.vnid}
                ></Input>
                <Input
                  name="bangumi_id"
                  label="Bangumi ID"
                  defaultValue={formdata.bangumi_id}
                ></Input>
                <Input
                  name="ymgal_id"
                  label="月幕 Gal ID"
                  defaultValue={formdata.ymgal_id}
                ></Input>
                <Select
                  name="credible"
                  defaultSelectedKeys={[`${formdata.credible}`]}
                  label="可信度"
                >
                  <SelectItem key="0">✍人工</SelectItem>
                  <SelectItem key="1">🤖机器</SelectItem>
                  <SelectItem key="2">❔未知</SelectItem>
                </Select>
                <div className="ml-auto grid gap-2 grid-cols-2">
                  <Button color="danger" variant="light" onPress={onClose}>
                    关闭
                  </Button>

                  <Button color="primary" type="submit">
                    提交
                  </Button>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
