import type { APIRoute } from 'astro';
import { loadEventsLoc } from '../../lib/events';

export const prerender = false;

export const GET: APIRoute = async () => {
  const events = await loadEventsLoc();
  
  return new Response(JSON.stringify(events), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
