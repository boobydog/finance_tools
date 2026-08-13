import { Table, TableHead, TableBody, TableRow, TableCell, Chip } from "@mui/material";
import type { BatchLog } from "@/types";

const STATUS_COLOR: Record<BatchLog["status"], "success" | "error" | "warning" | "info"> = {
  SUCCESS: "success",
  FAILED: "error",
  RETRYING: "warning",
  RUNNING: "info",
};

export function BatchLogTable({ logs }: { logs: BatchLog[] }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>処理名</TableCell>
          <TableCell>ステータス</TableCell>
          <TableCell>リトライ回数</TableCell>
          <TableCell>更新日時</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.logId}>
            <TableCell>{log.processName}</TableCell>
            <TableCell>
              <Chip label={log.status} size="small" color={STATUS_COLOR[log.status]} />
            </TableCell>
            <TableCell>{log.retryCount}</TableCell>
            <TableCell>{new Date(log.updatedAt).toLocaleString("ja-JP")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
