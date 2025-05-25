"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/animate-ui/radix/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/animate-ui/radix/switch";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/animate-ui/radix/dialog";
import {
  AlertCircle,
  Clock,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  Plus,
  Search,
  Settings,
  Activity,
  Timer,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

// Mock data - 更符合实际 BullMQ 场景
const mockActiveJobs = [
  {
    id: "job_active_001",
    name: "process-video",
    queue: "media-queue",
    status: "active",
    progress: 45,
    data: { videoId: "vid_123", quality: "1080p" },
    startedAt: "2024-01-15T10:32:00Z",
    attempts: 1,
    worker: "worker-01",
  },
  {
    id: "job_active_002",
    name: "send-bulk-email",
    queue: "email-queue",
    status: "active",
    progress: 78,
    data: { campaignId: "camp_456", recipients: 1500 },
    startedAt: "2024-01-15T10:30:15Z",
    attempts: 1,
    worker: "worker-02",
  },
];

const mockWaitingJobs = [
  {
    id: "job_wait_001",
    name: "generate-thumbnail",
    queue: "media-queue",
    status: "waiting",
    data: { imageUrl: "/uploads/photo.jpg", sizes: ["sm", "md", "lg"] },
    createdAt: "2024-01-15T10:35:00Z",
    priority: 5,
    attempts: 0,
  },
  {
    id: "job_wait_002",
    name: "backup-user-data",
    queue: "system-queue",
    status: "waiting",
    data: { userId: "user_789", includeFiles: true },
    createdAt: "2024-01-15T10:34:30Z",
    priority: 1,
    attempts: 0,
  },
  {
    id: "job_wait_003",
    name: "process-payment",
    queue: "payment-queue",
    status: "waiting",
    data: { orderId: "order_321", amount: 99.99 },
    createdAt: "2024-01-15T10:34:45Z",
    priority: 10,
    attempts: 0,
  },
];

const mockFailedJobs = [
  {
    id: "job_fail_001",
    name: "send-sms",
    queue: "notification-queue",
    status: "failed",
    data: { phone: "+1234567890", message: "验证码: 123456" },
    createdAt: "2024-01-15T10:20:00Z",
    failedAt: "2024-01-15T10:20:05Z",
    attempts: 3,
    error: "SMS service unavailable",
    stackTrace:
      "Error: SMS service unavailable\n    at sendSMS (/app/services/sms.js:45:12)",
  },
  {
    id: "job_fail_002",
    name: "process-image",
    queue: "media-queue",
    status: "failed",
    data: { imageUrl: "/uploads/corrupted.jpg", format: "webp" },
    createdAt: "2024-01-15T10:15:00Z",
    failedAt: "2024-01-15T10:15:08Z",
    attempts: 2,
    error: "Invalid image format",
    stackTrace:
      "Error: Invalid image format\n    at processImage (/app/services/image.js:23:8)",
  },
];

const mockDelayedJobs = [
  {
    id: "job_delay_001",
    name: "send-reminder",
    queue: "notification-queue",
    status: "delayed",
    data: { userId: "user_456", type: "meeting_reminder" },
    createdAt: "2024-01-15T10:00:00Z",
    delayUntil: "2024-01-15T11:00:00Z",
    attempts: 0,
  },
  {
    id: "job_delay_002",
    name: "cleanup-temp-files",
    queue: "system-queue",
    status: "delayed",
    data: { directory: "/tmp/uploads", olderThan: "24h" },
    createdAt: "2024-01-15T09:00:00Z",
    delayUntil: "2024-01-16T09:00:00Z",
    attempts: 0,
  },
];

const mockQueues = [
  {
    name: "email-queue",
    waiting: 12,
    active: 3,
    failed: 2,
    delayed: 5,
    paused: false,
    concurrency: 5,
    processed: 1250,
    retention: { completed: 100, failed: 500 },
  },
  {
    name: "media-queue",
    waiting: 8,
    active: 2,
    failed: 1,
    delayed: 0,
    paused: false,
    concurrency: 3,
    processed: 890,
    retention: { completed: 50, failed: 200 },
  },
  {
    name: "notification-queue",
    waiting: 25,
    active: 1,
    failed: 3,
    delayed: 8,
    paused: false,
    concurrency: 10,
    processed: 2340,
    retention: { completed: 200, failed: 1000 },
  },
  {
    name: "system-queue",
    waiting: 5,
    active: 0,
    failed: 0,
    delayed: 12,
    paused: true,
    concurrency: 2,
    processed: 456,
    retention: { completed: 20, failed: 100 },
  },
  {
    name: "payment-queue",
    waiting: 3,
    active: 1,
    failed: 0,
    delayed: 0,
    paused: false,
    concurrency: 8,
    processed: 3450,
    retention: { completed: 1000, failed: 2000 },
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "active":
      return <Activity className="h-4 w-4 text-blue-500" />;
    case "waiting":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "delayed":
      return <Timer className="h-4 w-4 text-orange-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    active: "default",
    waiting: "secondary",
    failed: "destructive",
    delayed: "outline",
  };

  return (
    <Badge
      variant={variants[status] || "outline"}
      className="flex items-center gap-1"
    >
      {getStatusIcon(status)}
      {status === "active"
        ? "执行中"
        : status === "waiting"
        ? "等待中"
        : status === "failed"
        ? "失败"
        : "延迟"}
    </Badge>
  );
};

export default function BullMQDashboard() {
  const [selectedQueue, setSelectedQueue] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // 模拟自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const totalStats = mockQueues.reduce(
    (acc, queue) => ({
      waiting: acc.waiting + queue.waiting,
      active: acc.active + queue.active,
      failed: acc.failed + queue.failed,
      delayed: acc.delayed + queue.delayed,
    }),
    { waiting: 0, active: 0, failed: 0, delayed: 0 }
  );

  const filterJobs = (jobs: any[]) => {
    return jobs.filter((job) => {
      const matchesQueue =
        selectedQueue === "all" || job.queue === selectedQueue;
      const matchesSearch =
        job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesQueue && matchesSearch;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">BullMQ 任务监控</h1>
            <p className="text-muted-foreground">实时监控任务队列状态</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                id="auto-refresh"
              />
              <Label htmlFor="auto-refresh" className="text-sm">
                自动刷新
              </Label>
            </div>
            <Button
              variant="outline"
              onClick={() => setLastRefresh(new Date())}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  添加任务
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加新任务</DialogTitle>
                  <DialogDescription>创建一个新的队列任务</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="job-name">任务名称</Label>
                    <Input id="job-name" placeholder="输入任务名称" />
                  </div>
                  <div>
                    <Label htmlFor="queue-select">选择队列</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="选择队列" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockQueues.map((queue) => (
                          <SelectItem key={queue.name} value={queue.name}>
                            {queue.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">优先级 (1-10)</Label>
                    <Input
                      id="priority"
                      type="number"
                      min="1"
                      max="10"
                      defaultValue="5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="delay">延迟时间 (秒)</Label>
                    <Input id="delay" type="number" min="0" defaultValue="0" />
                  </div>
                  <div>
                    <Label htmlFor="job-data">任务数据 (JSON)</Label>
                    <Input id="job-data" placeholder='{"key": "value"}' />
                  </div>
                  <Button className="w-full">创建任务</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Real-time Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">等待中</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStats.waiting}</div>
              <p className="text-xs text-muted-foreground">待处理任务</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">执行中</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStats.active}</div>
              <p className="text-xs text-muted-foreground">正在处理</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">失败</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStats.failed}</div>
              <p className="text-xs text-muted-foreground">需要处理</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">延迟</CardTitle>
              <Timer className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStats.delayed}</div>
              <p className="text-xs text-muted-foreground">定时任务</p>
            </CardContent>
          </Card>
        </div>

        <div className="text-xs text-muted-foreground">
          最后更新: {lastRefresh.toLocaleString("zh-CN")}
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">
              执行中 ({totalStats.active})
            </TabsTrigger>
            <TabsTrigger value="waiting">
              等待中 ({totalStats.waiting})
            </TabsTrigger>
            <TabsTrigger value="failed">失败 ({totalStats.failed})</TabsTrigger>
            <TabsTrigger value="delayed">
              延迟 ({totalStats.delayed})
            </TabsTrigger>
            <TabsTrigger value="queues">队列管理</TabsTrigger>
          </TabsList>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索任务名称或ID..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Select
                    value={selectedQueue}
                    onValueChange={setSelectedQueue}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有队列</SelectItem>
                      {mockQueues.map((queue) => (
                        <SelectItem key={queue.name} value={queue.name}>
                          {queue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <TabsContent value="active" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>正在执行的任务</CardTitle>
                <CardDescription>当前正在处理的任务列表</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务ID</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>队列</TableHead>
                      <TableHead>进度</TableHead>
                      <TableHead>工作进程</TableHead>
                      <TableHead>开始时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterJobs(mockActiveJobs).map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-sm">
                          {job.id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {job.name}
                        </TableCell>
                        <TableCell>{job.queue}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${job.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-sm">{job.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{job.worker}</TableCell>
                        <TableCell>
                          {new Date(job.startedAt).toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedJob(job)}
                          >
                            详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="waiting" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>等待队列</CardTitle>
                <CardDescription>等待处理的任务列表</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务ID</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>队列</TableHead>
                      <TableHead>优先级</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterJobs(mockWaitingJobs).map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-sm">
                          {job.id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {job.name}
                        </TableCell>
                        <TableCell>{job.queue}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              job.priority >= 8
                                ? "destructive"
                                : job.priority >= 5
                                ? "default"
                                : "secondary"
                            }
                          >
                            {job.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(job.createdAt).toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedJob(job)}
                            >
                              详情
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="failed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>失败任务</CardTitle>
                <CardDescription>需要处理的失败任务</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务ID</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>队列</TableHead>
                      <TableHead>尝试次数</TableHead>
                      <TableHead>失败时间</TableHead>
                      <TableHead>错误信息</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterJobs(mockFailedJobs).map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-sm">
                          {job.id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {job.name}
                        </TableCell>
                        <TableCell>{job.queue}</TableCell>
                        <TableCell>{job.attempts}</TableCell>
                        <TableCell>
                          {new Date(job.failedAt).toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {job.error}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedJob(job)}
                            >
                              详情
                            </Button>
                            <Button variant="outline" size="sm">
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delayed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>延迟任务</CardTitle>
                <CardDescription>定时执行的任务列表</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务ID</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>队列</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>执行时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterJobs(mockDelayedJobs).map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-mono text-sm">
                          {job.id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {job.name}
                        </TableCell>
                        <TableCell>{job.queue}</TableCell>
                        <TableCell>
                          {new Date(job.createdAt).toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell>
                          {new Date(job.delayUntil).toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedJob(job)}
                            >
                              详情
                            </Button>
                            <Button variant="outline" size="sm">
                              <Play className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queues" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockQueues.map((queue) => (
                <Card key={queue.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {queue.name}
                        {queue.paused && (
                          <Badge variant="secondary">已暂停</Badge>
                        )}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          {queue.paused ? (
                            <Play className="h-3 w-3" />
                          ) : (
                            <Pause className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">等待:</span>
                        <span className="font-medium">{queue.waiting}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">执行:</span>
                        <span className="font-medium">{queue.active}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">失败:</span>
                        <span className="font-medium">{queue.failed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">延迟:</span>
                        <span className="font-medium">{queue.delayed}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">并发数:</span>
                        <span className="font-medium">{queue.concurrency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">已处理:</span>
                        <span className="font-medium">
                          {queue.processed.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">保留策略:</span>
                        <span className="font-medium text-xs">
                          成功:{queue.retention.completed} / 失败:
                          {queue.retention.failed}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Job Details Dialog */}
        {selectedJob && (
          <Dialog
            open={!!selectedJob}
            onOpenChange={() => setSelectedJob(null)}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>任务详情</DialogTitle>
                <DialogDescription>任务 ID: {selectedJob.id}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>任务名称</Label>
                    <p className="font-medium">{selectedJob.name}</p>
                  </div>
                  <div>
                    <Label>队列</Label>
                    <p className="font-medium">{selectedJob.queue}</p>
                  </div>
                  <div>
                    <Label>状态</Label>
                    <div className="mt-1">
                      {getStatusBadge(selectedJob.status)}
                    </div>
                  </div>
                  <div>
                    <Label>尝试次数</Label>
                    <p className="font-medium">{selectedJob.attempts}</p>
                  </div>
                  {selectedJob.progress !== undefined && (
                    <div>
                      <Label>进度</Label>
                      <p className="font-medium">{selectedJob.progress}%</p>
                    </div>
                  )}
                  {selectedJob.priority && (
                    <div>
                      <Label>优先级</Label>
                      <p className="font-medium">{selectedJob.priority}</p>
                    </div>
                  )}
                  {selectedJob.worker && (
                    <div>
                      <Label>工作进程</Label>
                      <p className="font-medium">{selectedJob.worker}</p>
                    </div>
                  )}
                </div>

                <div>
                  <Label>任务数据</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-auto max-h-40">
                    {JSON.stringify(selectedJob.data, null, 2)}
                  </pre>
                </div>

                {selectedJob.error && (
                  <div>
                    <Label>错误信息</Label>
                    <p className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                      {selectedJob.error}
                    </p>
                  </div>
                )}

                {selectedJob.stackTrace && (
                  <div>
                    <Label>错误堆栈</Label>
                    <pre className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 overflow-auto max-h-32">
                      {selectedJob.stackTrace}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>创建时间</Label>
                    <p>
                      {new Date(selectedJob.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  {selectedJob.startedAt && (
                    <div>
                      <Label>开始时间</Label>
                      <p>
                        {new Date(selectedJob.startedAt).toLocaleString(
                          "zh-CN"
                        )}
                      </p>
                    </div>
                  )}
                  {selectedJob.failedAt && (
                    <div>
                      <Label>失败时间</Label>
                      <p>
                        {new Date(selectedJob.failedAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                  )}
                  {selectedJob.delayUntil && (
                    <div>
                      <Label>执行时间</Label>
                      <p>
                        {new Date(selectedJob.delayUntil).toLocaleString(
                          "zh-CN"
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  {selectedJob.status === "failed" && (
                    <Button>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      重试任务
                    </Button>
                  )}
                  {selectedJob.status === "delayed" && (
                    <Button>
                      <Play className="h-4 w-4 mr-2" />
                      立即执行
                    </Button>
                  )}
                  <Button variant="outline">
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除任务
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
