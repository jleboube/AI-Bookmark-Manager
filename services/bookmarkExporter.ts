

import { BookmarkNode } from '../types';

function generateHtml(nodes: BookmarkNode[], indentLevel: number): string {
  const indent = '    '.repeat(indentLevel);
  let html = `${indent}<DL><p>\n`;

  nodes.forEach(node => {
    if (node.type === 'folder') {
      html += `${indent}    <DT><H3 ADD_DATE="${node.addDate || Date.now() / 1000}" LAST_MODIFIED="${Date.now() / 1000}">${node.title}</H3>\n`;
      html += generateHtml(node.children, indentLevel + 1);
    } else if (node.type === 'bookmark') {
      html += `${indent}    <DT><A HREF="${node.url}" ADD_DATE="${node.addDate || Date.now() / 1000}"`;
      if (node.icon) {
        html += ` ICON="${node.icon}"`;
      }
      html += `>${node.title}</A>\n`;
    }
  });

  html += `${indent}</DL><p>\n`;
  return html;
}

export function exportBookmarks(bookmarks: BookmarkNode[]): string {
  const header = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>\n`;

  return header + generateHtml(bookmarks, 0);
}