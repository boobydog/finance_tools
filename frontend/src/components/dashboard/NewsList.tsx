import { List, ListItem, ListItemText, Link as MuiLink, Divider, Box } from "@mui/material";
import type { NewsItem } from "@/types";

export function NewsList({ news }: { news: NewsItem[] }) {
  return (
    <List disablePadding>
      {news.map((item, index) => (
        <Box key={item.id}>
          {index > 0 && <Divider component="li" />}
          <ListItem disablePadding sx={{ py: 1 }}>
            <ListItemText
              primary={
                <MuiLink href={item.url} target="_blank" rel="noopener noreferrer" underline="hover">
                  {item.title}
                </MuiLink>
              }
              secondary={`${item.source} ・ ${new Date(item.publishedAt).toLocaleString("ja-JP")}`}
            />
          </ListItem>
        </Box>
      ))}
    </List>
  );
}
